-- Private drafts and explicit public publication snapshots.
create table cx_private.content_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','editor'))
);
create table cx_private.drafts (
 slug text primary key check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug)<=160),
 payload jsonb not null, revision integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
create index drafts_actor on cx_private.drafts(updated_by);
create table cx_private.publications (
 slug text primary key references cx_private.drafts(slug),
 payload jsonb not null, revision integer not null,
 active boolean not null default true, published_at timestamptz not null default now()
);
create table cx_private.content_history (
 id bigint generated always as identity primary key,
 slug text not null references cx_private.drafts(slug),revision integer not null,
 action text not null, payload jsonb not null,
 actor uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index history_slug on cx_private.content_history(slug,id);
create index history_actor on cx_private.content_history(actor);
alter table cx_private.content_roles enable row level security;
alter table cx_private.drafts enable row level security;
alter table cx_private.publications enable row level security;
alter table cx_private.content_history enable row level security;
create policy deny_direct_client_access on cx_private.content_roles for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.drafts for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.publications for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.content_history for all to anon,authenticated using(false) with check(false);
revoke all on cx_private.content_roles,cx_private.drafts,cx_private.publications,cx_private.content_history from public,anon,authenticated;
revoke all on sequence cx_private.content_history_id_seq from public,anon,authenticated;

create function cx_private.editor_role() returns text language plpgsql stable security definer set search_path='' as $$
declare u uuid; r text;
begin
 u:=cx_private.require_member();
 select role into r from cx_private.content_roles where user_id=u;
 if r is null then raise exception using errcode='42501',message='editor_required'; end if;
 return r;
end $$;
create function cx_private.editor_read(p_slug text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r text; result jsonb;
begin
 r:=cx_private.editor_role();
 if p_slug is null then
  select jsonb_build_object('role',r,'posts',coalesce(jsonb_agg(x),'[]'::jsonb)) into result from (
   select d.slug,d.payload->>'title' as title,d.revision,d.updated_at,
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
create function cx_private.editor_write(p_action text,p_slug text,p_expected integer,p_payload jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; u uuid:=auth.uid(); d cx_private.drafts; rev integer; k text; t jsonb;
begin
 r:=cx_private.editor_role();
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug)>160 then raise exception 'invalid_slug'; end if;
 -- Same slug is serialized even before its first draft exists.
 perform pg_advisory_xact_lock(hashtextextended(p_slug,526));
 select * into d from cx_private.drafts where slug=p_slug for update;
 if coalesce(d.revision,0) is distinct from p_expected then raise exception 'revision_conflict'; end if;
 if p_action='save' then
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>180000 then raise exception 'invalid_content'; end if;
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
   if (d.payload->>'pubDate')::date > (now() at time zone 'Europe/Istanbul')::date then raise exception 'future_publication_date'; end if;
   insert into cx_private.publications(slug,payload,revision) values(p_slug,d.payload,rev)
    on conflict(slug) do update set payload=excluded.payload,revision=excluded.revision,active=true,published_at=now();
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
 return jsonb_build_object('ok',true,'revision',rev);
end $$;
create function cx_private.content_feed() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schema',1,'posts',coalesce(jsonb_agg(jsonb_build_object('slug',slug,'active',active,'revision',revision,
 'payload',case when active then payload else null end) order by slug),'[]'::jsonb)) from cx_private.publications
$$;
create function public.cx_editor_read(p_slug text default null) returns jsonb language sql stable security invoker set search_path='' as $$select cx_private.editor_read(p_slug)$$;
create function public.cx_editor_write(p_action text,p_slug text,p_expected integer,p_payload jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select cx_private.editor_write(p_action,p_slug,p_expected,p_payload)$$;
create function public.cx_content_feed() returns jsonb language sql stable security invoker set search_path='' as $$select cx_private.content_feed()$$;
revoke all on function cx_private.editor_role(),cx_private.editor_read(text),cx_private.editor_write(text,text,integer,jsonb),cx_private.content_feed() from public,anon,authenticated;
grant execute on function cx_private.editor_read(text),cx_private.editor_write(text,text,integer,jsonb) to authenticated;
grant execute on function cx_private.content_feed() to anon,authenticated;
revoke all on function public.cx_editor_read(text),public.cx_editor_write(text,text,integer,jsonb),public.cx_content_feed() from public,anon,authenticated;
grant execute on function public.cx_editor_read(text),public.cx_editor_write(text,text,integer,jsonb) to authenticated;
grant execute on function public.cx_content_feed() to anon,authenticated;
notify pgrst,'reload schema';
