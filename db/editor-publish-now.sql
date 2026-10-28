-- Save and publish as one transaction: failed publication rolls back the save.
create function cx_private.editor_publish_now(p_slug text,p_expected integer,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb;
begin
 if cx_private.editor_role()<>'owner' then raise exception using errcode='42501',message='publisher_required';end if;
 saved:=cx_private.editor_write('save',p_slug,p_expected,p_payload);
 return cx_private.editor_write('publish',p_slug,(saved->>'revision')::integer,null);
end $$;
revoke all on function cx_private.editor_publish_now(text,integer,jsonb) from public,anon,authenticated;
grant execute on function cx_private.editor_publish_now(text,integer,jsonb) to authenticated;
create function public.cx_editor_publish_now(p_slug text,p_expected integer,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$select cx_private.editor_publish_now(p_slug,p_expected,p_payload)$$;
revoke all on function public.cx_editor_publish_now(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.cx_editor_publish_now(text,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
