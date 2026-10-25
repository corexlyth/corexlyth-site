-- Existing hidden comments remain unpublished until an admin publishes or deletes them.
create or replace function cx_private.community_read(p_post text default null,p_after bigint default 0,p_queue boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); m boolean; blocked boolean; result jsonb; rows_json jsonb;
begin
 select coalesce(bool_or(moderator and not members.blocked),false),coalesce(bool_or(members.blocked),false)
 into m,blocked from cx_private.members where user_id=u;
 if p_queue and not m then raise exception using errcode='42501',message='moderator_required'; end if;
 if p_after is null or p_after<0 then raise exception 'invalid_cursor'; end if;
 if p_post is not null and not exists(select 1 from cx_private.posts where slug=p_post and active) then raise exception 'post_not_found'; end if;
 select coalesce(jsonb_agg(row_data order by id),'[]'::jsonb) into rows_json from (
  select c.id,jsonb_build_object('id',c.id::text,'post',c.post_slug,'parent',c.parent_id::text,
   'name',case when c.status='deleted' then 'Üye' else coalesce(p.display_name,'Anonim') end,
   'body',c.body,'status',c.status,'createdAt',c.created_at,'own',coalesce(c.user_id=u,false)) as row_data
  from cx_private.comments c left join cx_private.profiles p on p.user_id=c.user_id
  join cx_private.posts post on post.slug=c.post_slug and post.active
  where c.id>p_after and (
   (p_queue and c.status in ('pending','published','hidden')) or
   (not p_queue and p_post is not null and c.post_slug=p_post and (c.status in ('published','deleted') or c.user_id=u or m))
  ) order by c.id limit 51
 ) page;
 result:=jsonb_build_object('comments',rows_json,'moderator',m,'blocked',blocked,'signedIn',u is not null,
  'displayName',(select display_name from cx_private.profiles where user_id=u),
  'likes',case when p_post is null then 0 else (select count(*) from cx_private.likes where post_slug=p_post) end,
  'liked',exists(select 1 from cx_private.likes where post_slug=p_post and user_id=u),
  'saved',exists(select 1 from cx_private.bookmarks where post_slug=p_post and user_id=u));
 if p_post is null and not p_queue then
  result:=result||jsonb_build_object('bookmarks',(select coalesce(jsonb_agg(jsonb_build_object('slug',p.slug,'title',p.title) order by b.created_at desc),'[]'::jsonb)
   from (select * from cx_private.bookmarks where user_id=u order by created_at desc limit 100) b join cx_private.posts p on p.slug=b.post_slug and p.active));
 end if;
 return result;
end $$;

create or replace function cx_private.community_write(p_action text,p_post text default null,p_body text default null,p_comment bigint default null,p_value boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; m boolean; c cx_private.comments; parent cx_private.comments; new_id bigint;
begin
 u:=cx_private.require_member();
 select coalesce(bool_or(moderator and not blocked),false) into m from cx_private.members where user_id=u;
 if p_action in ('comment','like','bookmark') and not exists(select 1 from cx_private.posts where slug=p_post and active) then raise exception 'post_not_found'; end if;
 if p_action='profile' then
  perform cx_private.throttle(u,'profile',2,30);
  if btrim(coalesce(p_body,''))='' then
   delete from cx_private.profiles where user_id=u;
  else
   if char_length(btrim(p_body)) not between 2 and 40 or p_body ~ '[[:cntrl:]]' then raise exception 'invalid_name'; end if;
   insert into cx_private.profiles(user_id,display_name) values(u,btrim(p_body)) on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now();
  end if;
 elsif p_action='comment' then
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'invalid_comment'; end if;
  if p_comment is not null then
   select * into parent from cx_private.comments where id=p_comment for share;
   if not found or parent.post_slug<>p_post or parent.parent_id is not null or parent.status<>'published' then raise exception 'invalid_parent'; end if;
  end if;
  perform cx_private.throttle(u,'comment',30,10);
  insert into cx_private.comments(post_slug,user_id,parent_id,body) values(p_post,u,p_comment,btrim(p_body)) returning id into new_id;
 elsif p_action in ('like','bookmark') then
  if p_value is null then raise exception 'invalid_value'; end if;
  perform cx_private.throttle(u,'reaction_'||p_action,1,120);
  if p_action='like' then
   if p_value then insert into cx_private.likes values(p_post,u) on conflict do nothing;
   else delete from cx_private.likes where post_slug=p_post and user_id=u; end if;
  else
   if p_value then insert into cx_private.bookmarks(user_id,post_slug) values(u,p_post) on conflict do nothing;
   else delete from cx_private.bookmarks where post_slug=p_post and user_id=u; end if;
  end if;
 elsif p_action in ('delete','publish','block','unblock') then
  select * into c from cx_private.comments where id=p_comment for update;
  if not found then raise exception 'comment_not_found'; end if;
  if p_action='delete' then
   if c.user_id is distinct from u and not m then raise exception using errcode='42501',message='not_owner'; end if;
   update cx_private.comments set body='[Yorum silindi]',status='deleted',updated_at=now() where id=c.id;
   if m then insert into cx_private.moderation_log(actor_id,comment_id,action) values(u,c.id,p_action); end if;
  else
   if not m then raise exception using errcode='42501',message='moderator_required'; end if;
   if p_action='publish' then
    if c.status='deleted' then raise exception 'comment_deleted'; end if;
    update cx_private.comments set status='published',updated_at=now() where id=c.id;
   else
    if c.user_id is null or c.user_id=u or exists(select 1 from cx_private.members where user_id=c.user_id and moderator) then raise exception 'invalid_member'; end if;
    insert into cx_private.members(user_id,blocked) values(c.user_id,p_action='block') on conflict(user_id) do update set blocked=excluded.blocked;
   end if;
   insert into cx_private.moderation_log(actor_id,comment_id,action) values(u,c.id,p_action);
  end if;
 else raise exception 'invalid_action';
 end if;
 return jsonb_build_object('ok',true,'id',new_id::text);
end $$;

