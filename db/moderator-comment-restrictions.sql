-- Resolve the target from a comment without exposing user IDs in the queue.
create function cx_private.comment_restriction_from_comment(p_comment bigint,p_minutes integer,p_release boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; staff_role text;
begin
 actor:=cx_private.require_member();
 select role into staff_role from cx_private.staff_roles where user_id=actor;
 if staff_role is null or staff_role not in ('admin','moderator') then
  raise exception using errcode='42501',message='moderator_required';
 end if;
 select user_id into target from cx_private.comments where id=p_comment and status<>'deleted';
 if target is null then raise exception 'comment_not_found'; end if;
 return cx_private.comment_restriction_set(target,p_minutes,p_release);
end $$;
revoke all on function cx_private.comment_restriction_from_comment(bigint,integer,boolean) from public,anon,authenticated;
grant execute on function cx_private.comment_restriction_from_comment(bigint,integer,boolean) to authenticated;
create function public.cx_comment_restriction_from_comment(p_comment bigint,p_minutes integer,p_release boolean default false)
returns jsonb language sql security invoker set search_path='' as $$select cx_private.comment_restriction_from_comment(p_comment,p_minutes,p_release)$$;
revoke all on function public.cx_comment_restriction_from_comment(bigint,integer,boolean) from public,anon,authenticated;
grant execute on function public.cx_comment_restriction_from_comment(bigint,integer,boolean) to authenticated;
notify pgrst,'reload schema';
