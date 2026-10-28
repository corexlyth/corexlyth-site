-- Preparation uses the caller's identity; completion is reserved to trusted backend service.
grant execute on function cx_private.prepare_ban_operation(uuid,text) to authenticated;
create function public.cx_ban_operation_start(p_target uuid,p_operation text) returns uuid
language sql security invoker set search_path='' as $$select cx_private.prepare_ban_operation(p_target,p_operation)$$;
revoke all on function public.cx_ban_operation_start(uuid,text) from public,anon,authenticated;
grant execute on function public.cx_ban_operation_start(uuid,text) to authenticated;

create function cx_private.finish_ban_operation(p_id uuid,p_state text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_state not in ('succeeded','failed') or p_state is null then raise exception 'invalid_state';end if;
 update cx_private.account_ban_operations set state=p_state,finished_at=now()
 where id=p_id and state='pending' and expires_at>now();
 return found;
end $$;
revoke all on function cx_private.finish_ban_operation(uuid,text) from public,anon,authenticated;
grant usage on schema cx_private to service_role;
grant execute on function cx_private.finish_ban_operation(uuid,text) to service_role;
create function public.cx_ban_operation_finish(p_id uuid,p_state text) returns boolean
language sql security invoker set search_path='' as $$select cx_private.finish_ban_operation(p_id,p_state)$$;
revoke all on function public.cx_ban_operation_finish(uuid,text) from public,anon,authenticated;
grant execute on function public.cx_ban_operation_finish(uuid,text) to service_role;
notify pgrst,'reload schema';
