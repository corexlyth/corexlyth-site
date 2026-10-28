create table cx_private.author_comment_likes (
 comment_id bigint primary key references cx_private.comments(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table cx_private.author_comment_likes enable row level security;
create policy deny_direct_client_access on cx_private.author_comment_likes for all to anon,authenticated using(false) with check(false);
revoke all on cx_private.author_comment_likes from public,anon,authenticated;

create function cx_private.author_comment_action(p_action text,p_comment bigint,p_body text default null,p_value boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; slug text; parent bigint;
begin
 actor:=cx_private.require_member();
 if not exists(select 1 from cx_private.staff_roles where user_id=actor and role in ('author','moderator','admin')) then raise exception using errcode='42501',message='editor_required';end if;
 select c.post_slug,c.parent_id into slug,parent from cx_private.comments c
 join cx_private.drafts d on d.slug=c.post_slug and d.author_id=actor
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
revoke all on function cx_private.author_comment_action(text,bigint,text,boolean) from public,anon,authenticated;
grant execute on function cx_private.author_comment_action(text,bigint,text,boolean) to authenticated;
create function public.cx_author_comment_action(p_action text,p_comment bigint,p_body text default null,p_value boolean default null)
returns jsonb language sql security invoker set search_path='' as $$select cx_private.author_comment_action(p_action,p_comment,p_body,p_value)$$;
revoke all on function public.cx_author_comment_action(text,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.cx_author_comment_action(text,bigint,text,boolean) to authenticated;

-- Authenticated writers can read published comments only on their own live posts.
create or replace function cx_private.author_comments() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; entries jsonb;
begin
 actor:=cx_private.require_member();
 if not exists(select 1 from cx_private.staff_roles where user_id=actor and role in ('author','moderator','admin')) then
  raise exception using errcode='42501',message='editor_required';
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into entries from (
  select c.id::text id,c.parent_id::text parent,c.post_slug slug,p.title,c.body,c.created_at,exists(select 1 from cx_private.author_comment_likes l where l.comment_id=c.id and l.author_id=actor) liked,coalesce(pr.display_name,'Anonim') name
  from cx_private.comments c
  join cx_private.drafts d on d.slug=c.post_slug and d.author_id=actor
  join cx_private.posts p on p.slug=c.post_slug and p.active
  left join cx_private.profiles pr on pr.user_id=c.user_id
  where c.status='published' order by c.created_at desc,c.id desc limit 50
 ) x;
 return jsonb_build_object('comments',entries);
end $$;

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
