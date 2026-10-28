-- Reject banned accounts even if an unexpired access token is still presented.
create or replace function cx_private.require_member() returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null and is_anonymous is not true) then
  raise exception using errcode='42501',message='login_required';
 end if;
 if exists(select 1 from auth.users where id=u and banned_until>now()) then
  raise exception using errcode='42501',message='account_banned';
 end if;
 if exists(select 1 from cx_private.members where user_id=u and blocked) then
  raise exception using errcode='42501',message='member_blocked';
 end if;
 return u;
end $$;

create or replace function cx_private.can_edit_media() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from cx_private.staff_roles r join auth.users u on u.id=r.user_id
 where r.user_id=auth.uid() and u.email_confirmed_at is not null and u.is_anonymous is not true
 and (u.banned_until is null or u.banned_until<=now())
 and not exists(select 1 from cx_private.members m where m.user_id=u.id and m.blocked))
$$;

create or replace function cx_private.community_read(p_post text default null,p_after bigint default 0,p_queue boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); m boolean; blocked boolean; result jsonb; rows_json jsonb;
begin
 select coalesce(bool_or(moderator and not members.blocked),false),coalesce(bool_or(members.blocked),false)
 into m,blocked from cx_private.members where user_id=u;
 if exists(select 1 from auth.users where id=u and banned_until>now()) then m:=false;blocked:=true;end if;
 if p_queue and not m then raise exception using errcode='42501',message='moderator_required'; end if;
 if p_after is null or p_after<0 then raise exception 'invalid_cursor'; end if;
 if p_post is not null and not exists(select 1 from cx_private.posts where slug=p_post and active) then raise exception 'post_not_found'; end if;
 select coalesce(jsonb_agg(row_data order by id),'[]'::jsonb) into rows_json from (
  select c.id,jsonb_build_object('id',c.id::text,'post',c.post_slug,'parent',c.parent_id::text,
   'name',case when c.status='deleted' then 'Üye' else coalesce(p.display_name,'Anonim') end,
   'body',c.body,'status',c.status,'createdAt',c.created_at,'own',coalesce(c.user_id=u,false), 'authorLiked',exists(select 1 from cx_private.author_comment_likes l join cx_private.drafts d on d.slug=c.post_slug and d.author_id=l.author_id where l.comment_id=c.id)) as row_data
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


notify pgrst,'reload schema';
