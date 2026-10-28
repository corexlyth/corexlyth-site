-- Separate comment restrictions from the legacy general community block.
create table cx_private.comment_restrictions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 expires_at timestamptz,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
create table cx_private.restriction_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 target_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('comment_restrict','comment_release')),
 expires_at timestamptz, created_at timestamptz not null default now()
);
alter table cx_private.comment_restrictions enable row level security;
alter table cx_private.restriction_audit enable row level security;
create policy deny_direct_client_access on cx_private.comment_restrictions for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.restriction_audit for all to anon,authenticated using(false) with check(false);
revoke all on cx_private.comment_restrictions,cx_private.restriction_audit from public,anon,authenticated;
revoke all on sequence cx_private.restriction_audit_id_seq from public,anon,authenticated;

create function cx_private.comment_restriction_set(p_target uuid,p_minutes integer,p_release boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; role_name text; target_role text; until_at timestamptz;
begin
 actor:=cx_private.require_member();
 select role into role_name from cx_private.staff_roles where user_id=actor;
 if role_name not in ('admin','moderator') or role_name is null then raise exception using errcode='42501',message='moderator_required'; end if;
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
revoke all on function cx_private.comment_restriction_set(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function cx_private.comment_restriction_set(uuid,integer,boolean) to authenticated;
create function public.cx_comment_restriction_set(p_target uuid,p_minutes integer,p_release boolean default false)
returns jsonb language sql security invoker set search_path='' as $$select cx_private.comment_restriction_set(p_target,p_minutes,p_release)$$;
revoke all on function public.cx_comment_restriction_set(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.cx_comment_restriction_set(uuid,integer,boolean) to authenticated;

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


notify pgrst,'reload schema';
