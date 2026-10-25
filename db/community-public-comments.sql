-- Article reads never include pending/hidden comments, including for their author and moderators.
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
   (not p_queue and p_post is not null and c.post_slug=p_post and c.status in ('published','deleted'))
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

