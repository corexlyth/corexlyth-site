begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,is_anonymous) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','editor-owner@example.invalid',now(),false),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','editor-writer@example.invalid',now(),false),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','authenticated','authenticated','editor-member@example.invalid',now(),false);
insert into cx_private.content_roles values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','editor');
set local role anon;
do $$ declare denied boolean:=false; begin
 begin perform public.cx_editor_read();exception when insufficient_privilege then denied:=true;end;
 assert denied,'anonymous cannot read drafts';
end $$;
reset role;set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","user_metadata":{"role":"owner"}}',true);
do $$ declare denied boolean:=false; begin
 begin perform public.cx_editor_read();exception when insufficient_privilege then denied:=true;end;
 assert denied,'member metadata cannot grant editorial role';
end $$;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
do $$ declare p jsonb; denied boolean:=false; f jsonb; begin
 p:=jsonb_build_object('title','PRIVATE CANARY DRAFT','description','A valid description longer than thirty five characters.','body','SECRET_BODY_SENTINEL','category','Test','tags',jsonb_build_array('Test'),'cover','assets/img/corexlyth-code.svg','coverAlt','Test illustration','pubDate','2026-10-25','featured',false);
 perform public.cx_editor_write('save','cx-editor-transaction-test',0,p);
 f:=public.cx_content_feed();assert f::text not like '%SECRET_BODY_SENTINEL%','saved drafts never enter public feed';
 begin perform public.cx_editor_write('save','cx-editor-transaction-test',0,p);exception when others then denied:=sqlerrm='revision_conflict';end;
 assert denied,'stale revision cannot overwrite a draft';
 perform public.cx_editor_write('publish','cx-editor-transaction-test',1);
 assert public.cx_content_feed()::text like '%SECRET_BODY_SENTINEL%','owner publication exposes saved snapshot';
 assert public.cx_community_read('cx-editor-transaction-test')->>'likes'='0','community registry created atomically';
end $$;
reset role;
update cx_private.limits set last_at=now()-interval '1 minute' where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
do $$ declare d jsonb; begin
 d:=public.cx_editor_read('cx-editor-transaction-test');
 perform public.cx_editor_write('save','cx-editor-transaction-test',1,jsonb_set(d->'payload','{body}','"PRIVATE_REVISION_TWO"'));
 assert public.cx_content_feed()::text not like '%PRIVATE_REVISION_TWO%','editing a live draft does not change published snapshot';
end $$;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}',true);
do $$ declare denied boolean:=false; begin
 assert public.cx_editor_read('cx-editor-transaction-test')->>'revision'='2','editor can read latest draft';
 begin perform public.cx_editor_write('publish','cx-editor-transaction-test',2);exception when insufficient_privilege then denied:=true;end;
 assert denied,'editor cannot publish';
end $$;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select public.cx_editor_write('unpublish','cx-editor-transaction-test',2);
do $$ declare denied boolean:=false; begin
 assert public.cx_content_feed()::text not like '%SECRET_BODY_SENTINEL%' and public.cx_content_feed()::text not like '%PRIVATE_REVISION_TWO%','withdrawal feed exposes no body';
 begin perform public.cx_community_read('cx-editor-transaction-test');exception when others then denied:=sqlerrm='post_not_found';end;
 assert denied,'withdrawal disables new interactions';
 denied:=false;begin execute 'select * from cx_private.drafts';exception when insufficient_privilege then denied:=true;end;
 assert denied,'direct draft table access denied';
end $$;
reset role;rollback;
select 'PASS: private drafts, role isolation, optimistic revisions, immutable publication snapshot, atomic registry and withdrawal' as result;
