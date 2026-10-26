-- Existing installation: editorial metadata for the private article library.
create or replace function cx_private.editor_read(p_slug text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r text; result jsonb;
begin
 r:=cx_private.editor_role();
 if p_slug is null then
  select jsonb_build_object('role',r,'posts',coalesce(jsonb_agg(x),'[]'::jsonb)) into result from (
   select d.slug,d.payload->>'title' as title,d.payload->>'category' as category,d.payload->>'description' as description,d.revision,d.updated_at,
    coalesce(p.active,false) as published,p.revision as published_revision
   from cx_private.drafts d left join cx_private.publications p on p.slug=d.slug order by d.updated_at desc,d.slug limit 500
  ) x;
 else
  select jsonb_build_object('role',r,'slug',d.slug,'payload',d.payload,'revision',d.revision,
   'published',coalesce(p.active,false),'publishedRevision',p.revision) into result
  from cx_private.drafts d left join cx_private.publications p on p.slug=d.slug where d.slug=p_slug;
  if result is null then raise exception 'draft_not_found'; end if;
 end if;
 return result;
end $$;
notify pgrst,'reload schema';
