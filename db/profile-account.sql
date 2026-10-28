-- Private, owner-only nickname history and personal comment overview.
create table cx_private.profile_name_history (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check(char_length(display_name) between 2 and 40),
 used_until timestamptz not null default now()
);
create index profile_name_history_user_page on cx_private.profile_name_history(user_id,id desc);
create index comments_owner_page on cx_private.comments(user_id,id desc);
alter table cx_private.profile_name_history enable row level security;
create policy deny_direct_client_access on cx_private.profile_name_history for all to anon,authenticated using(false) with check(false);
revoke all on cx_private.profile_name_history from public,anon,authenticated;
revoke all on sequence cx_private.profile_name_history_id_seq from public,anon,authenticated;
create function cx_private.record_previous_profile_name() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if exists(select 1 from auth.users where id=old.user_id) then
   insert into cx_private.profile_name_history(user_id,display_name) values(old.user_id,old.display_name);
  end if;
  return old;
 end if;
 if old.display_name is distinct from new.display_name then
  insert into cx_private.profile_name_history(user_id,display_name) values(old.user_id,old.display_name);
 end if;
 return new;
end $$;
revoke all on function cx_private.record_previous_profile_name() from public,anon,authenticated;
create trigger record_previous_profile_name after update of display_name or delete on cx_private.profiles for each row execute function cx_private.record_previous_profile_name();
create function cx_private.personal_profile(p_kind text,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=cx_private.require_member(); result jsonb;
begin
 if p_before is not null and p_before<=0 then raise exception 'invalid_cursor';end if;
 if p_kind='names' then
  select jsonb_build_object('items',coalesce(jsonb_agg(x.data order by x.id desc),'[]'::jsonb),'next',case when count(*)=51 then min(x.id)::text else null end) into result from (
   select id,jsonb_build_object('id',id::text,'name',display_name,'usedUntil',used_until) data from cx_private.profile_name_history where user_id=u and (p_before is null or id<p_before) order by id desc limit 51
  ) x;
 elsif p_kind='comments' then
  select jsonb_build_object('items',coalesce(jsonb_agg(x.data order by x.id desc),'[]'::jsonb),'next',case when count(*)=51 then min(x.id)::text else null end) into result from (
   select c.id,jsonb_build_object('id',c.id::text,'post',c.post_slug,'postTitle',p.title,'active',p.active,'body',case when c.status='deleted' then '' else c.body end,'status',c.status,'createdAt',c.created_at) data from cx_private.comments c join cx_private.posts p on p.slug=c.post_slug where c.user_id=u and (p_before is null or c.id<p_before) order by c.id desc limit 51
  ) x;
 else raise exception 'invalid_profile_section';end if;
 return result;
end $$;
revoke all on function cx_private.personal_profile(text,bigint) from public,anon,authenticated;
grant execute on function cx_private.personal_profile(text,bigint) to authenticated;
create function public.cx_personal_profile(p_kind text,p_before bigint default null) returns jsonb language sql stable security invoker set search_path='' as $$select cx_private.personal_profile(p_kind,p_before)$$;
revoke all on function public.cx_personal_profile(text,bigint) from public,anon,authenticated;
grant execute on function public.cx_personal_profile(text,bigint) to authenticated;
notify pgrst,'reload schema';
