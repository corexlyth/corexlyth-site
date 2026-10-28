-- Staged coordination for trusted Auth administration; this does not ban anyone.
create table cx_private.account_ban_operations (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 target_id uuid not null references auth.users(id),
 operation text not null check(operation in ('ban_1d','ban_7d','ban_long','unban')),
 state text not null default 'pending' check(state in ('pending','succeeded','failed')),
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 expires_at timestamptz not null default now()+interval '2 minutes'
);
create index account_ban_operations_actor on cx_private.account_ban_operations(actor_id,created_at desc);
create index account_ban_operations_target on cx_private.account_ban_operations(target_id,created_at desc);
alter table cx_private.account_ban_operations enable row level security;
create policy deny_direct_client_access on cx_private.account_ban_operations for all to anon,authenticated using(false) with check(false);
revoke all on cx_private.account_ban_operations from public,anon,authenticated;

-- Serialize with role changes by locking both corresponding auth.users rows.
create function cx_private.guard_staff_role_during_ban() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid:=coalesce(new.user_id,old.user_id);
begin
 perform 1 from auth.users where id=target for update;
 if exists(select 1 from cx_private.account_ban_operations where state='pending' and expires_at>now() and (actor_id=target or target_id=target)) then
  raise exception 'account_ban_operation_pending';
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function cx_private.guard_staff_role_during_ban() from public,anon,authenticated;
create trigger guard_staff_role_during_ban before insert or update or delete on cx_private.staff_roles
 for each row execute function cx_private.guard_staff_role_during_ban();

create function cx_private.prepare_ban_operation(p_target uuid,p_operation text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; op_id uuid;
begin
 actor:=cx_private.require_member();
 if p_target is null or p_target=actor or p_operation not in ('ban_1d','ban_7d','ban_long','unban') or p_operation is null then raise exception 'invalid_request';end if;
 perform id from auth.users where id in (actor,p_target) order by id for update;
 if not cx_private.account_ban_allowed(p_target) then raise exception using errcode='42501',message='not_authorized';end if;
 if exists(select 1 from cx_private.account_ban_operations where state='pending' and expires_at>now() and target_id=p_target) then raise exception 'operation_pending';end if;
 perform cx_private.throttle(actor,'account_ban_prepare',2,30);
 insert into cx_private.account_ban_operations(actor_id,target_id,operation) values(actor,p_target,p_operation) returning id into op_id;
 return op_id;
end $$;
revoke all on function cx_private.prepare_ban_operation(uuid,text) from public,anon,authenticated;
