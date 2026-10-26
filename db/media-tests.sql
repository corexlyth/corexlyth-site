-- RLS/registry fixtures are metadata-only and are fully rolled back; no storage file is created here.
begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,is_anonymous) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','media-owner@example.invalid',now(),false),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','media-editor@example.invalid',now(),false),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','authenticated','authenticated','media-mod@example.invalid',now(),false);
insert into cx_private.content_roles values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','editor');
insert into cx_private.members(user_id,moderator) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}',true);
do $$ declare denied boolean:=false;begin
 begin perform public.cx_media('list');exception when insufficient_privilege then denied:=true;end;assert denied,'comment moderator cannot access media';
 denied:=false;begin insert into storage.objects(bucket_id,name) values('cx-editor-media','cccccccc-cccc-4ccc-8ccc-cccccccccccc/11111111-1111-4111-8111-111111111111.webp');exception when insufficient_privilege then denied:=true;end;assert denied,'comment moderator cannot upload';
end $$;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
insert into storage.objects(bucket_id,name,metadata) values('cx-editor-media','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp','{"size":32,"mimetype":"image/webp"}');
select public.cx_media('register','{"object":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp","alt":"Test image description","width":1200,"height":800}');
select public.cx_editor_write('save','cx-media-test',0,'{"title":"Media publication test","description":"A valid test description longer than thirty five characters.","body":"![Test image](/corexlyth-site/assets/img/uploads/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp)","pubDate":"2026-10-25","category":"Test","tags":["Test"],"cover":"assets/img/uploads/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp","coverAlt":"Test image description","featured":false}');
reset role;set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 assert (select count(*) from storage.objects where bucket_id='cx-editor-media' and name='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp')=0,'draft image hidden from anon';
 assert public.cx_content_feed()::text not like '%dddddddd-dddd-4ddd-8ddd-dddddddddddd%','draft media excluded from public feed';
end $$;
reset role;set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select public.cx_editor_write('publish','cx-media-test',1);
-- Registered immutable objects cannot be overwritten/deleted through the client.
update storage.objects set metadata='{"size":999}' where bucket_id='cx-editor-media' and name='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp';
do $$ begin assert not cx_private.orphan_media_object('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp'),'registered object cannot match cleanup policy';end $$;
reset role;set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 assert (select count(*) from storage.objects where bucket_id='cx-editor-media' and name='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp')=1,'published image readable by anonymous build';
 assert public.cx_content_feed()->'assets' @> '[{"asset_path":"assets/img/uploads/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp","bytes":32}]'::jsonb,'published asset exported once';
end $$;
reset role;set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}',true);
do $$ declare denied boolean:=false;begin
 begin insert into storage.objects(bucket_id,name) values('cx-editor-media','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.webp');exception when insufficient_privilege then denied:=true;end;assert denied,'editor cannot upload under another owner prefix';
end $$;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select public.cx_editor_write('unpublish','cx-media-test',1);
reset role;set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 assert (select count(*) from storage.objects where bucket_id='cx-editor-media' and name='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp')=0,'withdrawn unused media is private again';
 assert public.cx_content_feed()::text not like '%dddddddd-dddd-4ddd-8ddd-dddddddddddd%','withdrawal excludes unused media from build feed';
end $$;
reset role;rollback;
select 'PASS: media role/prefix isolation, draft privacy, atomic publication access, immutable registered files and withdrawal' as result;
