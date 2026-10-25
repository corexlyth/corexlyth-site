-- CoreXLyth community v1. All tables stay outside the exposed API schema.
create schema cx_private;
revoke all on schema cx_private from public, anon, authenticated;
grant usage on schema cx_private to anon, authenticated;

create table cx_private.posts (
 slug text primary key check (slug ~ '^[a-z0-9-]{1,160}$'),
 title text not null, active boolean not null default true
);
create table cx_private.members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 moderator boolean not null default false, blocked boolean not null default false
);
create table cx_private.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(display_name) between 2 and 40),
 updated_at timestamptz not null default now()
);
create table cx_private.comments (
 id bigint generated always as identity primary key,
 post_slug text not null references cx_private.posts(slug),
 user_id uuid references auth.users(id) on delete set null,
 parent_id bigint references cx_private.comments(id),
 body text not null check (char_length(body) between 1 and 2000),
 status text not null default 'pending' check(status in ('pending','published','hidden','deleted')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index comments_post_page on cx_private.comments(post_slug,id);
create index comments_queue on cx_private.comments(status,id);
create index comments_user on cx_private.comments(user_id);
create index comments_parent on cx_private.comments(parent_id);
create table cx_private.likes (
 post_slug text not null references cx_private.posts(slug),
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(post_slug,user_id)
);
create index likes_user on cx_private.likes(user_id);
create table cx_private.bookmarks (
 user_id uuid not null references auth.users(id) on delete cascade,
 post_slug text not null references cx_private.posts(slug),
 created_at timestamptz not null default now(), primary key(user_id,post_slug)
);
create index bookmarks_post on cx_private.bookmarks(post_slug);
create table cx_private.limits (
 user_id uuid not null references auth.users(id) on delete cascade,
 bucket text not null, last_at timestamptz not null, window_at timestamptz not null,
 hits integer not null, primary key(user_id,bucket)
);
create table cx_private.moderation_log (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 comment_id bigint references cx_private.comments(id),
 action text not null, created_at timestamptz not null default now()
);
create index moderation_actor on cx_private.moderation_log(actor_id);
create index moderation_comment on cx_private.moderation_log(comment_id);
alter table cx_private.posts enable row level security;
alter table cx_private.members enable row level security;
alter table cx_private.profiles enable row level security;
alter table cx_private.comments enable row level security;
alter table cx_private.likes enable row level security;
alter table cx_private.bookmarks enable row level security;
alter table cx_private.limits enable row level security;
alter table cx_private.moderation_log enable row level security;
-- Explicit deny policies are defense in depth; checked gateways below own access.
create policy deny_direct_client_access on cx_private.posts for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.members for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.profiles for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.comments for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.likes for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.bookmarks for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.limits for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.moderation_log for all to anon,authenticated using(false) with check(false);
revoke all on all tables in schema cx_private from public, anon, authenticated;
revoke all on all sequences in schema cx_private from public, anon, authenticated;

create function cx_private.require_member() returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid();
begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null and is_anonymous is not true) then
  raise exception using errcode='42501',message='login_required';
 end if;
 if exists(select 1 from cx_private.members where user_id=u and blocked) then
  raise exception using errcode='42501',message='member_blocked';
 end if;
 return u;
end $$;

create function cx_private.throttle(u uuid,b text,gap_seconds integer,max_hits integer) returns void
language plpgsql security definer set search_path='' as $$
declare l cx_private.limits; t timestamptz:=clock_timestamp();
begin
 insert into cx_private.limits values(u,b,t-interval '1 day',t,0) on conflict do nothing;
 select * into l from cx_private.limits where user_id=u and bucket=b for update;
 if t-l.last_at < make_interval(secs=>gap_seconds) then raise exception 'rate_limited'; end if;
 if t-l.window_at >= interval '1 hour' then l.window_at:=t; l.hits:=0; end if;
 if l.hits>=max_hits then raise exception 'rate_limited'; end if;
 update cx_private.limits set last_at=t,window_at=l.window_at,hits=l.hits+1 where user_id=u and bucket=b;
end $$;

create function cx_private.community_read(p_post text default null,p_after bigint default 0,p_queue boolean default false)
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

create function cx_private.community_write(p_action text,p_post text default null,p_body text default null,p_comment bigint default null,p_value boolean default null)
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

-- Invoker wrappers expose only the bounded, authorization-checked private gateways.
create function public.cx_community_read(p_post text default null,p_after bigint default 0,p_queue boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
 select cx_private.community_read(p_post,p_after,p_queue)
$$;
create function public.cx_community_write(p_action text,p_post text default null,p_body text default null,p_comment bigint default null,p_value boolean default null)
returns jsonb language sql security invoker set search_path='' as $$
 select cx_private.community_write(p_action,p_post,p_body,p_comment,p_value)
$$;
revoke all on all functions in schema cx_private from public,anon,authenticated;
grant execute on function cx_private.community_read(text,bigint,boolean) to anon,authenticated;
grant execute on function cx_private.community_write(text,text,text,bigint,boolean) to authenticated;
revoke all on function public.cx_community_read(text,bigint,boolean) from public;
grant execute on function public.cx_community_read(text,bigint,boolean) to anon,authenticated;
revoke all on function public.cx_community_write(text,text,text,bigint,boolean) from public,anon;
grant execute on function public.cx_community_write(text,text,text,bigint,boolean) to authenticated;
notify pgrst,'reload schema';
