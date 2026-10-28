create or replace function cx_private.staff_posts(p_action text,p_slug text default null,p_expected integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; staff_role text; draft_row cx_private.drafts; result jsonb;
begin
 actor:=cx_private.require_member();
 select role into staff_role from cx_private.staff_roles where user_id=actor;
 if staff_role is null or staff_role not in ('admin','moderator') then raise exception using errcode='42501',message='moderator_required';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.slug),'[]'::jsonb) into result from (
   select d.slug,d.payload->>'title' title,d.revision,d.updated_at,coalesce(p.active,false) published
   from cx_private.drafts d left join cx_private.publications p on p.slug=d.slug
   where d.deleted_at is null and (staff_role='admin' or p.active)
   order by d.updated_at desc,d.slug limit 100
  ) x;
  return jsonb_build_object('posts',result);
 elsif p_action='delete' then
  if p_slug is null or p_expected is null then raise exception 'invalid_request';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_slug,526));
  select * into draft_row from cx_private.drafts where slug=p_slug for update;
  if draft_row.slug is null or draft_row.deleted_at is not null or (staff_role='moderator' and not exists(select 1 from cx_private.publications where slug=p_slug and active)) then raise exception 'post_not_found';end if;
  if draft_row.revision<>p_expected then raise exception 'revision_conflict';end if;
  update cx_private.drafts set deleted_at=now(),updated_at=now() where slug=p_slug;
  update cx_private.publications set active=false where slug=p_slug;
  update cx_private.posts set active=false where slug=p_slug;
  insert into cx_private.content_history(slug,revision,action,payload,actor) values(p_slug,draft_row.revision,'delete',draft_row.payload,actor);
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'invalid_action';
end $$;

notify pgrst,'reload schema';
