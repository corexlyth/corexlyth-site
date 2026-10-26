insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cx-editor-media','cx-editor-media',false,2097152,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table cx_private.media (
 id uuid primary key,object_name text unique not null,asset_path text unique not null,
 owner_id uuid references auth.users(id) on delete set null,
 alt text not null check(char_length(alt) between 5 and 300),
 width integer not null check(width between 1 and 1920),height integer not null check(height between 1 and 1920),
 bytes integer not null check(bytes between 1 and 2097152),created_at timestamptz not null default now()
);
create index media_owner on cx_private.media(owner_id);
create table cx_private.publication_media (
 post_slug text references cx_private.publications(slug) on delete cascade,
 media_id uuid references cx_private.media(id),primary key(post_slug,media_id)
);
create index publication_media_asset on cx_private.publication_media(media_id);
alter table cx_private.media enable row level security;
alter table cx_private.publication_media enable row level security;
create policy deny_direct_client_access on cx_private.media for all to anon,authenticated using(false) with check(false);
create policy deny_direct_client_access on cx_private.publication_media for all to anon,authenticated using(false) with check(false);
revoke all on cx_private.media,cx_private.publication_media from public,anon,authenticated;

create function cx_private.can_edit_media() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from cx_private.content_roles r join auth.users u on u.id=r.user_id
 where r.user_id=auth.uid() and u.email_confirmed_at is not null and u.is_anonymous is not true
 and not exists(select 1 from cx_private.members m where m.user_id=u.id and m.blocked))
$$;
create function cx_private.public_media_object(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from cx_private.media m join cx_private.publication_media pm on pm.media_id=m.id
 join cx_private.publications p on p.slug=pm.post_slug and p.active where m.object_name=p_name)
$$;
create function cx_private.orphan_media_object(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from cx_private.media where object_name=p_name)
$$;
revoke all on function cx_private.can_edit_media(),cx_private.public_media_object(text),cx_private.orphan_media_object(text) from public,anon,authenticated;
grant execute on function cx_private.can_edit_media(),cx_private.orphan_media_object(text) to authenticated;
grant execute on function cx_private.public_media_object(text) to anon,authenticated;
create policy cx_media_upload on storage.objects for insert to authenticated with check(
 bucket_id='cx-editor-media' and cx_private.can_edit_media() and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
create policy cx_media_editor_read on storage.objects for select to authenticated using(bucket_id='cx-editor-media' and cx_private.can_edit_media());
create policy cx_media_public_read on storage.objects for select to anon,authenticated using(bucket_id='cx-editor-media' and cx_private.public_media_object(name));
create policy cx_media_failed_upload_cleanup on storage.objects for delete to authenticated using(
 bucket_id='cx-editor-media' and cx_private.can_edit_media() and (storage.foldername(name))[1]=(select auth.uid())::text
 and cx_private.orphan_media_object(name));

create function cx_private.media_api(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
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
  select to_jsonb(m)-'owner_id' into r from cx_private.media m where id=mid;
 elsif p_action='get' then
  select to_jsonb(m)-'owner_id' into r from cx_private.media m where asset_path=p_data->>'asset';
  if r is null then raise exception 'media_not_found';end if;
 elsif p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(m)-'owner_id'),'[]'::jsonb) into r from (select * from cx_private.media order by created_at desc,id limit 100) m;
 else raise exception 'invalid_action';end if;
 return r;
end $$;
revoke all on function cx_private.media_api(text,jsonb) from public,anon,authenticated;
grant execute on function cx_private.media_api(text,jsonb) to authenticated;
create function public.cx_media(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select cx_private.media_api(p_action,p_data)$$;
revoke all on function public.cx_media(text,jsonb) from public,anon,authenticated;
grant execute on function public.cx_media(text,jsonb) to authenticated;

create function cx_private.sync_publication_media() returns trigger language plpgsql security definer set search_path='' as $$
declare ref text;mid uuid;n integer:=0;
begin
 delete from cx_private.publication_media where post_slug=new.slug;
 for ref in select distinct captures[1] from regexp_matches((new.payload->>'cover')||E'\n'||(new.payload->>'body'),'assets/img/uploads/([0-9a-f-]{36})\.webp','g') as matches(captures) loop
  n:=n+1;if n>100 then raise exception 'too_many_images';end if;
  mid:=ref::uuid;
  if not exists(select 1 from cx_private.media where id=mid) then raise exception 'media_not_found';end if;
  insert into cx_private.publication_media values(new.slug,mid);
 end loop;
 return new;
end $$;
revoke all on function cx_private.sync_publication_media() from public,anon,authenticated;
create trigger sync_publication_media after insert or update on cx_private.publications for each row execute function cx_private.sync_publication_media();

create or replace function cx_private.content_feed() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schema',1,'posts',(select coalesce(jsonb_agg(jsonb_build_object('slug',slug,'active',active,'revision',revision,
 'payload',case when active then payload else null end) order by slug),'[]'::jsonb) from cx_private.publications),
 'assets',(select coalesce(jsonb_agg(to_jsonb(x) order by x.asset_path),'[]'::jsonb) from (
  select distinct m.asset_path,m.object_name,m.bytes,m.width,m.height from cx_private.media m
  join cx_private.publication_media pm on pm.media_id=m.id join cx_private.publications p on p.slug=pm.post_slug and p.active
 ) x))
$$;
notify pgrst,'reload schema';
