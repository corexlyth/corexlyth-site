create function cx_private.prepare_ban_from_comment(p_comment bigint,p_operation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; operation_id uuid;
begin
 perform cx_private.require_member();
 select user_id into target from cx_private.comments where id=p_comment and status<>'deleted';
 if target is null then raise exception 'comment_not_found';end if;
 operation_id:=cx_private.prepare_ban_operation(target,p_operation);
 return jsonb_build_object('id',operation_id,'target',target);
end $$;
revoke all on function cx_private.prepare_ban_from_comment(bigint,text) from public,anon,authenticated;
grant execute on function cx_private.prepare_ban_from_comment(bigint,text) to authenticated;
create function public.cx_ban_from_comment(p_comment bigint,p_operation text) returns jsonb
language sql security invoker set search_path='' as $$select cx_private.prepare_ban_from_comment(p_comment,p_operation)$$;
revoke all on function public.cx_ban_from_comment(bigint,text) from public,anon,authenticated;
grant execute on function public.cx_ban_from_comment(bigint,text) to authenticated;
notify pgrst,'reload schema';
