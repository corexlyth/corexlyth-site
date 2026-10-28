-- Deletion is distinct from unpublishing: retain a private tombstone for
-- publication processing and audit, and prevent normal editing or republishing.
alter table cx_private.drafts add column deleted_at timestamptz;
create function cx_private.staff_posts(p_action text,p_slug text default null,p_expected integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; staff_role text; d cx_private.drafts; result jsonb;
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
  select * into d from cx_private.drafts where slug=p_slug for update;
  if d.slug is null or d.deleted_at is not null or (staff_role='moderator' and not exists(select 1 from cx_private.publications where slug=p_slug and active)) then raise exception 'post_not_found';end if;
  if d.revision<>p_expected then raise exception 'revision_conflict';end if;
  update cx_private.drafts set deleted_at=now(),updated_at=now() where slug=p_slug;
  update cx_private.publications set active=false where slug=p_slug;
  update cx_private.posts set active=false where slug=p_slug;
  insert into cx_private.content_history(slug,revision,action,payload,actor) values(p_slug,d.revision,'delete',d.payload,actor);
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function cx_private.staff_posts(text,text,integer) from public,anon,authenticated;
grant execute on function cx_private.staff_posts(text,text,integer) to authenticated;
create function public.cx_staff_posts(p_action text,p_slug text default null,p_expected integer default null)
returns jsonb language sql security invoker set search_path='' as $$select cx_private.staff_posts(p_action,p_slug,p_expected)$$;
revoke all on function public.cx_staff_posts(text,text,integer) from public,anon,authenticated;
grant execute on function public.cx_staff_posts(text,text,integer) to authenticated;

create or replace function cx_private.editor_read(p_slug text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r text; result jsonb;
begin
 r:=cx_private.editor_role();
 if p_slug is null then
  select jsonb_build_object('role',r,'posts',coalesce(jsonb_agg(x),'[]'::jsonb)) into result from (
   select d.slug,d.payload->>'title' as title,d.payload->>'category' as category,d.payload->>'description' as description,d.revision,d.updated_at,
    coalesce(p.active,false) as published,p.revision as published_revision
   from cx_private.drafts d left join cx_private.publications p on p.slug=d.slug where d.deleted_at is null and (r='owner' or d.author_id=auth.uid()) order by d.updated_at desc,d.slug limit 500
  ) x;
 else
  select jsonb_build_object('role',r,'slug',d.slug,'payload',d.payload,'revision',d.revision,
   'published',coalesce(p.active,false),'publishedRevision',p.revision) into result
  from cx_private.drafts d left join cx_private.publications p on p.slug=d.slug where d.slug=p_slug and d.deleted_at is null and (r='owner' or d.author_id=auth.uid());
  if result is null then raise exception 'draft_not_found'; end if;
 end if;
 return result;
end $$;

create or replace function cx_private.editor_write(p_action text,p_slug text,p_expected integer,p_payload jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; u uuid:=auth.uid(); d cx_private.drafts; rev integer; k text; t jsonb; publication_date text;
begin
 r:=cx_private.editor_role();
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug)>160 then raise exception 'invalid_slug'; end if;
 -- Same slug is serialized even before its first draft exists.
 perform pg_advisory_xact_lock(hashtextextended(p_slug,526));
 select * into d from cx_private.drafts where slug=p_slug for update;
 if d.deleted_at is not null then raise exception using errcode='42501',message='draft_not_found'; end if;
 if d.slug is not null and not cx_private.staff_draft_allowed('edit',p_slug) then raise exception using errcode='42501',message='draft_not_found'; end if;
 if coalesce(d.revision,0) is distinct from p_expected then raise exception 'revision_conflict'; end if;
 -- Dates are server-owned. Existing publications retain their original public date.
 select payload->>'pubDate' into publication_date from cx_private.publications where slug=p_slug;
 publication_date:=coalesce(publication_date,to_char(now() at time zone 'Europe/Istanbul','YYYY-MM-DD'));
 if p_action='save' then
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>180000 then raise exception 'invalid_content'; end if;
  p_payload:=jsonb_set(p_payload,'{pubDate}',to_jsonb(publication_date));
  foreach k in array array['title','description','body','category','cover','coverAlt','pubDate'] loop
   if jsonb_typeof(p_payload->k) is distinct from 'string' then raise exception 'invalid_content'; end if;
  end loop;
  if char_length(btrim(p_payload->>'title')) not between 8 and 200
   or char_length(btrim(p_payload->>'description')) not between 35 and 220
   or char_length(btrim(p_payload->>'body')) not between 1 and 100000
   or char_length(btrim(p_payload->>'category')) not between 2 and 80
   or char_length(p_payload->>'coverAlt') not between 5 and 300
   or p_payload->>'cover' !~ '^assets/img/[a-zA-Z0-9/_-]+\.(svg|png|jpg|jpeg|webp|avif)$'
   or p_payload->>'cover' like '%..%'
   or p_payload->>'pubDate' !~ '^\d{4}-\d{2}-\d{2}$'
   or jsonb_typeof(p_payload->'featured') is distinct from 'boolean'
   or jsonb_typeof(p_payload->'tags') is distinct from 'array'
   then raise exception 'invalid_content'; end if;
  perform (p_payload->>'pubDate')::date;
  if jsonb_array_length(p_payload->'tags') not between 1 and 20 then raise exception 'invalid_content'; end if;
  for t in select * from jsonb_array_elements(p_payload->'tags') loop
   if jsonb_typeof(t)<>'string' or char_length(btrim(t#>>'{}')) not between 2 and 50 then raise exception 'invalid_content'; end if;
  end loop;
  perform cx_private.throttle(u,'editor_save',1,120);
  rev:=coalesce(d.revision,0)+1;
  -- Allowlisted fields only; a client cannot inject a role/status/draft flag.
  p_payload:=jsonb_build_object('title',btrim(p_payload->>'title'),'description',btrim(p_payload->>'description'),
   'body',p_payload->>'body','category',btrim(p_payload->>'category'),'tags',p_payload->'tags',
   'cover',p_payload->>'cover','coverAlt',p_payload->>'coverAlt','pubDate',p_payload->>'pubDate','featured',p_payload->'featured');
  insert into cx_private.drafts(slug,payload,revision,updated_by) values(p_slug,p_payload,rev,u)
   on conflict(slug) do update set payload=excluded.payload,revision=excluded.revision,updated_at=now(),updated_by=u;
 elsif p_action in ('publish','unpublish') then
  if r<>'owner' then raise exception using errcode='42501',message='publisher_required'; end if;
  if d.slug is null then raise exception 'draft_not_found'; end if;
  rev:=d.revision;p_payload:=d.payload;
  if p_action='publish' then
   p_payload:=jsonb_set(d.payload,'{pubDate}',to_jsonb(publication_date));
   update cx_private.drafts set payload=p_payload where slug=p_slug;
   insert into cx_private.publications(slug,payload,revision) values(p_slug,p_payload,rev)
    on conflict(slug) do update set payload=excluded.payload,revision=excluded.revision,active=true;
   insert into cx_private.posts(slug,title,active) values(p_slug,d.payload->>'title',true)
    on conflict(slug) do update set title=excluded.title,active=true;
  else
   -- An unpublished snapshot still carries a tombstone for the static build.
   update cx_private.publications set active=false where slug=p_slug;
   update cx_private.posts set active=false where slug=p_slug;
  end if;
 else raise exception 'invalid_action';
 end if;
 insert into cx_private.content_history(slug,revision,action,payload,actor) values(p_slug,rev,p_action,p_payload,u);
 return jsonb_build_object('ok',true,'revision',rev,'pubDate',p_payload->>'pubDate');
end $$;

notify pgrst,'reload schema';
