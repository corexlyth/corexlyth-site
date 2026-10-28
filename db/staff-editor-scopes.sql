-- Integrate staff editing while leaving publishing restricted to existing owner.
create or replace function cx_private.editor_role() returns text language plpgsql stable security definer set search_path='' as $$
declare u uuid; r text;
begin
 u:=cx_private.require_member();
 select role into r from cx_private.staff_roles where user_id=u;
 if r is null then raise exception using errcode='42501',message='editor_required'; end if;
 return case when r='admin' then 'owner' else 'editor' end;
end $$;

create or replace function cx_private.can_edit_media() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from cx_private.staff_roles r join auth.users u on u.id=r.user_id
 where r.user_id=auth.uid() and u.email_confirmed_at is not null and u.is_anonymous is not true
 and not exists(select 1 from cx_private.members m where m.user_id=u.id and m.blocked))
$$;
create function cx_private.staff_media_allowed(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select cx_private.can_edit_media() and (
  exists(select 1 from cx_private.staff_roles r where r.user_id=auth.uid() and r.role='admin')
  or split_part(p_name,'/',1)=auth.uid()::text
  or cx_private.public_media_object(p_name))
$$;
revoke all on function cx_private.staff_media_allowed(text) from public,anon,authenticated;
grant execute on function cx_private.staff_media_allowed(text) to authenticated;
drop policy cx_media_editor_read on storage.objects;
create policy cx_media_editor_read on storage.objects for select to authenticated
 using(bucket_id='cx-editor-media' and cx_private.staff_media_allowed(name));

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
   from cx_private.drafts d left join cx_private.publications p on p.slug=d.slug where r='owner' or d.author_id=auth.uid() order by d.updated_at desc,d.slug limit 500
  ) x;
 else
  select jsonb_build_object('role',r,'slug',d.slug,'payload',d.payload,'revision',d.revision,
   'published',coalesce(p.active,false),'publishedRevision',p.revision) into result
  from cx_private.drafts d left join cx_private.publications p on p.slug=d.slug where d.slug=p_slug and (r='owner' or d.author_id=auth.uid());
  if result is null then raise exception 'draft_not_found'; end if;
 end if;
 return result;
end $$;
notify pgrst,'reload schema';

-- Run after editor.sql: publication dates are assigned by the server.
create or replace function cx_private.editor_write(p_action text,p_slug text,p_expected integer,p_payload jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; u uuid:=auth.uid(); d cx_private.drafts; rev integer; k text; t jsonb; publication_date text;
begin
 r:=cx_private.editor_role();
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug)>160 then raise exception 'invalid_slug'; end if;
 -- Same slug is serialized even before its first draft exists.
 perform pg_advisory_xact_lock(hashtextextended(p_slug,526));
 select * into d from cx_private.drafts where slug=p_slug for update;
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

create or replace function cx_private.media_api(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r jsonb;object_path text;mid uuid;sz integer;
begin
 perform cx_private.editor_role();
 if p_action='register' then
  object_path:=p_data->>'object';
  if object_path is null or object_path !~ ('^'||u::text||'/[0-9a-f-]{36}\.webp$') then raise exception 'invalid_media';end if;
  mid:=split_part(split_part(object_path,'/',2),'.',1)::uuid;
  select (metadata->>'size')::integer into sz from storage.objects o where o.bucket_id='cx-editor-media' and o.name=object_path and metadata->>'mimetype'='image/webp';
  if not found or sz not between 1 and 2097152 or char_length(btrim(p_data->>'alt')) not between 5 and 300
   or (p_data->>'width')::integer not between 1 and 1920 or (p_data->>'height')::integer not between 1 and 1920
   or p_data->>'alt' is null or p_data->>'width' is null or p_data->>'height' is null then raise exception 'invalid_media';end if;
  perform cx_private.throttle(u,'media_register',1,40);
  insert into cx_private.media(id,object_name,asset_path,owner_id,alt,width,height,bytes)
   values(mid,object_path,'assets/img/uploads/'||mid::text||'.webp',u,btrim(p_data->>'alt'),(p_data->>'width')::integer,(p_data->>'height')::integer,sz)
   on conflict(id) do nothing;
  select to_jsonb(m)-'owner_id' into r from cx_private.media m where id=mid and owner_id=u;
  if r is null then raise exception 'invalid_media'; end if;
 elsif p_action='get' then
  select to_jsonb(m)-'owner_id' into r from cx_private.media m where asset_path=p_data->>'asset' and cx_private.staff_media_allowed(m.object_name);
  if r is null then raise exception 'media_not_found';end if;
 elsif p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(m)-'owner_id'),'[]'::jsonb) into r from (select * from cx_private.media where cx_private.staff_media_allowed(object_name) order by created_at desc,id limit 100) m;
 else raise exception 'invalid_action';end if;
 return r;
end $$;

notify pgrst,'reload schema';
