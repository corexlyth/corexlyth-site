-- Simplify the application to administrators and members.
revoke execute on function public.cx_ban_operation_start(uuid,text), public.cx_ban_from_comment(bigint,text) from public,anon,authenticated;
revoke execute on function cx_private.prepare_ban_operation(uuid,text),cx_private.prepare_ban_from_comment(bigint,text) from public,anon,authenticated;
revoke execute on function public.cx_ban_operation_finish(uuid,text),cx_private.finish_ban_operation(uuid,text) from public,anon,authenticated,service_role;
revoke execute on function public.cx_author_assignment(text,text,uuid),cx_private.author_assignment(text,text,uuid) from public,anon,authenticated;
delete from cx_private.staff_roles where role<>'admin';
delete from cx_private.content_roles where user_id not in (select user_id from cx_private.staff_roles where role='admin');
update cx_private.members set moderator=exists(select 1 from cx_private.staff_roles s where s.user_id=members.user_id and s.role='admin'),blocked=false;
alter table cx_private.comments add column was_published boolean not null default false;
update cx_private.comments c set was_published=true where c.status='published' or exists(select 1 from cx_private.moderation_log l where l.comment_id=c.id and l.action='publish');
create function cx_private.mark_comment_published() returns trigger language plpgsql set search_path='' as $$
begin new.was_published:=old.was_published or new.status='published';return new;end $$;
revoke all on function cx_private.mark_comment_published() from public,anon,authenticated;
create trigger mark_comment_published before update on cx_private.comments for each row execute function cx_private.mark_comment_published();
create or replace function cx_private.require_member() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();begin if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null and is_anonymous is not true) then raise exception using errcode='42501',message='login_required';end if;return u;end $$;
create or replace function cx_private.editor_role() returns text language plpgsql stable security definer set search_path='' as $$
declare u uuid;begin u:=cx_private.require_member();if not exists(select 1 from cx_private.staff_roles where user_id=u and role='admin') then raise exception using errcode='42501',message='editor_required';end if;return 'owner';end $$;
create or replace function cx_private.can_edit_media() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from cx_private.staff_roles r join auth.users u on u.id=r.user_id where r.user_id=auth.uid() and r.role='admin' and u.email_confirmed_at is not null and u.is_anonymous is not true)
$$;

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
   'body',c.body,'status',c.status,'createdAt',c.created_at,'own',coalesce(c.user_id=u,false), 'authorLiked',exists(select 1 from cx_private.author_comment_likes l join cx_private.staff_roles d on d.user_id=l.author_id and d.role='admin' where l.comment_id=c.id)) as row_data
  from cx_private.comments c left join cx_private.profiles p on p.user_id=c.user_id
  join cx_private.posts post on post.slug=c.post_slug and post.active
  where c.id>p_after and (
   (p_queue and c.status in ('pending','published','hidden')) or
   (not p_queue and p_post is not null and c.post_slug=p_post and (c.status='published' or (c.status='deleted' and c.was_published)))
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


notify pgrst,'reload schema';

create or replace function cx_private.community_write(p_action text,p_post text default null,p_body text default null,p_comment bigint default null,p_value boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; m boolean; c cx_private.comments; parent cx_private.comments; new_id bigint;
begin
 u:=cx_private.require_member();
 if p_action='comment' and exists(select 1 from cx_private.comment_restrictions where user_id=u and (expires_at is null or expires_at>now())) then raise exception using errcode='42501',message='comment_restricted'; end if;
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
 elsif p_action in ('delete','publish') then
  select * into c from cx_private.comments where id=p_comment for update;
  if not found then raise exception 'comment_not_found'; end if;
  if p_action='delete' then
   if c.user_id is distinct from u and not m then raise exception using errcode='42501',message='not_owner'; end if;
   update cx_private.comments set body='[Yorum silindi]',status='deleted',updated_at=now() where id=c.id;
   if m then insert into cx_private.moderation_log(actor_id,comment_id,action) values(u,c.id,p_action); end if;
  else
   if not m then raise exception using errcode='42501',message='moderator_required'; end if;
   if c.status='deleted' then raise exception 'comment_deleted'; end if;
   update cx_private.comments set status='published',updated_at=now() where id=c.id;
   insert into cx_private.moderation_log(actor_id,comment_id,action) values(u,c.id,p_action);
  end if;
 else raise exception 'invalid_action';
 end if;
 return jsonb_build_object('ok',true,'id',new_id::text);
end $$;


notify pgrst,'reload schema';

create or replace function cx_private.staff_posts(p_action text,p_slug text default null,p_expected integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; staff_role text; draft_row cx_private.drafts; result jsonb;
begin
 actor:=cx_private.require_member();
 select role into staff_role from cx_private.staff_roles where user_id=actor;
 if staff_role is null or staff_role<>'admin' then raise exception using errcode='42501',message='moderator_required';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.slug),'[]'::jsonb) into result from (
   select d.slug,d.payload->>'title' title,d.revision,d.updated_at,coalesce(p.active,false) published
   from cx_private.drafts d left join cx_private.publications p on p.slug=d.slug
   where d.deleted_at is null and (staff_role='admin' or p.active)
   order by d.updated_at desc,d.slug limit 100
  ) x;
  return jsonb_build_object('posts',result);
 elsif p_action='delete' then
  if p_slug is null or p_expected is null then raise exception 'invalid_request';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_slug,526));
  select * into draft_row from cx_private.drafts where slug=p_slug for update;
  if draft_row.slug is null or draft_row.deleted_at is not null or (staff_role='moderator' and not exists(select 1 from cx_private.publications where slug=p_slug and active)) then raise exception 'post_not_found';end if;
  if draft_row.revision<>p_expected then raise exception 'revision_conflict';end if;
  update cx_private.drafts set deleted_at=now(),updated_at=now() where slug=p_slug;
  update cx_private.publications set active=false where slug=p_slug;
  update cx_private.posts set active=false where slug=p_slug;
  insert into cx_private.content_history(slug,revision,action,payload,actor) values(p_slug,draft_row.revision,'delete',draft_row.payload,actor);
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'invalid_action';
end $$;

notify pgrst,'reload schema';

create or replace function cx_private.comment_restriction_set(p_target uuid,p_minutes integer,p_release boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; role_name text; target_role text; until_at timestamptz;
begin
 actor:=cx_private.require_member();
 select role into role_name from cx_private.staff_roles where user_id=actor;
 if role_name<>'admin' or role_name is null then raise exception using errcode='42501',message='moderator_required'; end if;
 if p_target is null or p_target=actor or p_release is null then raise exception 'invalid_target'; end if;
 if not exists(select 1 from auth.users where id=p_target and is_anonymous is not true) then raise exception 'invalid_target'; end if;
 select role into target_role from cx_private.staff_roles where user_id=p_target;
 if target_role='admin' or (role_name='moderator' and target_role='moderator') then raise exception 'invalid_target'; end if;
 if not p_release and p_minutes is not null and (p_minutes<1 or p_minutes>525600) then raise exception 'invalid_duration'; end if;
 if p_release then
  delete from cx_private.comment_restrictions where user_id=p_target;
 else
  until_at:=case when p_minutes is null then null else now()+make_interval(mins=>p_minutes) end;
  insert into cx_private.comment_restrictions(user_id,expires_at,updated_by) values(p_target,until_at,actor)
   on conflict(user_id) do update set expires_at=excluded.expires_at,updated_by=excluded.updated_by,updated_at=now();
 end if;
 insert into cx_private.restriction_audit(actor_id,target_id,action,expires_at)
  values(actor,p_target,case when p_release then 'comment_release' else 'comment_restrict' end,until_at);
 return jsonb_build_object('ok',true,'expiresAt',until_at);
end $$;

create or replace function cx_private.author_comment_action(p_action text,p_comment bigint,p_body text default null,p_value boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; slug text; parent bigint;
begin
 actor:=cx_private.require_member();
 if not exists(select 1 from cx_private.staff_roles where user_id=actor and role='admin') then raise exception using errcode='42501',message='editor_required';end if;
 select c.post_slug,c.parent_id into slug,parent from cx_private.comments c
 join cx_private.drafts d on d.slug=c.post_slug
 join cx_private.posts p on p.slug=c.post_slug and p.active
 where c.id=p_comment and c.status='published';
 if not found then raise exception 'comment_not_found';end if;
 if p_action='reply' then
  if parent is not null then raise exception 'invalid_parent';end if;
  return cx_private.community_write('comment',slug,p_body,p_comment,null);
 elsif p_action='like' then
  if p_value is null then raise exception 'invalid_value';end if;
  perform cx_private.throttle(actor,'author_comment_like',1,120);
  if p_value then insert into cx_private.author_comment_likes(comment_id,author_id) values(p_comment,actor) on conflict(comment_id) do update set author_id=excluded.author_id,created_at=now();
  else delete from cx_private.author_comment_likes where comment_id=p_comment and author_id=actor;end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'invalid_action';
end $$;

create or replace function cx_private.author_comments() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; entries jsonb;
begin
 actor:=cx_private.require_member();
 if not exists(select 1 from cx_private.staff_roles where user_id=actor and role='admin') then
  raise exception using errcode='42501',message='editor_required';
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into entries from (
  select c.id::text id,c.parent_id::text parent,c.post_slug slug,p.title,c.body,c.created_at,exists(select 1 from cx_private.author_comment_likes l where l.comment_id=c.id and l.author_id=actor) liked,coalesce(pr.display_name,'Anonim') name
  from cx_private.comments c
  join cx_private.drafts d on d.slug=c.post_slug
  join cx_private.posts p on p.slug=c.post_slug and p.active
  left join cx_private.profiles pr on pr.user_id=c.user_id
  where c.status='published' order by c.created_at desc,c.id desc limit 50
 ) x;
 return jsonb_build_object('comments',entries);
end $$;


create or replace function cx_private.staff_admin(p_action text,p_user uuid default null,p_role text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb;begin
 actor:=cx_private.require_member();if not exists(select 1 from cx_private.staff_roles where user_id=actor and role='admin') then raise exception using errcode='42501',message='admin_required';end if;
 if p_action<>'list' then raise exception 'invalid_action';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) into result from (select u.id,u.email,u.created_at,pr.display_name,(cr.user_id is not null and (cr.expires_at is null or cr.expires_at>now())) comment_restricted,cr.expires_at comment_restriction_until from auth.users u left join cx_private.profiles pr on pr.user_id=u.id left join cx_private.comment_restrictions cr on cr.user_id=u.id where u.is_anonymous is not true order by u.created_at desc,u.id limit 100) x;return jsonb_build_object('users',result);end $$;

notify pgrst,'reload schema';
