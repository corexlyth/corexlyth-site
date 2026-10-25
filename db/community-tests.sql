-- Transactional integration tests: synthetic users and all test writes are rolled back.
begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,is_anonymous)
values('11111111-1111-4111-8111-111111111111','authenticated','authenticated','cx-test-a@example.invalid',now(),false),
('22222222-2222-4222-8222-222222222222','authenticated','authenticated','cx-test-b@example.invalid',now(),false),
('33333333-3333-4333-8333-333333333333','authenticated','authenticated','cx-test-m@example.invalid',now(),false),
('44444444-4444-4444-8444-444444444444','authenticated','authenticated','cx-test-unverified@example.invalid',null,false);
insert into cx_private.members(user_id,moderator) values('33333333-3333-4333-8333-333333333333',true);
select set_config('cx.test.baseline_likes',(select count(*) from cx_private.likes where post_slug='android-izinlerini-kontrol-et')::text,true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$
declare a jsonb; id text; hit boolean:=false;
begin
 perform public.cx_community_write('profile',p_body=>'<img src=x onerror=alert(1)>');
 a:=public.cx_community_write('comment','android-izinlerini-kontrol-et','<script>alert(1)</script>');
 id:=a->>'id'; perform set_config('cx.test.comment',id,true);
 a:=public.cx_community_read('android-izinlerini-kontrol-et',id::bigint-1);
 assert a->'comments' @> jsonb_build_array(jsonb_build_object('id',id,'status','pending','own',true)), 'author sees own pending';
 begin perform public.cx_community_write('comment','android-izinlerini-kontrol-et','burst'); exception when others then hit:=sqlerrm='rate_limited'; end;
 assert hit,'comment burst blocked';
 perform public.cx_community_write('like','android-izinlerini-kontrol-et',p_value=>true);
 begin execute 'select * from cx_private.members'; exception when insufficient_privilege then hit:=true; end;
 -- Check direct access independently of earlier rate-limit assertion.
 hit:=false;
 begin execute 'update cx_private.members set moderator=true'; exception when insufficient_privilege then hit:=true; end;
 assert hit,'role escalation denied';
 hit:=false;
 begin perform public.cx_community_write('publish',p_comment=>id::bigint); exception when insufficient_privilege then hit:=true; end;
 assert hit,'normal member cannot moderate';
end $$;
reset role;
-- Advance only synthetic test throttle rows to exercise idempotency and independent writes.
update cx_private.limits set last_at=now()-interval '1 hour' where user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
do $$
begin
 perform public.cx_community_write('like','android-izinlerini-kontrol-et',p_value=>true);
 assert (public.cx_community_read('android-izinlerini-kontrol-et')->>'likes')::integer=current_setting('cx.test.baseline_likes')::integer+1,'duplicate like remains one';
end $$;
reset role;
update cx_private.limits set last_at=now()-interval '1 hour' where user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select public.cx_community_write('bookmark','android-izinlerini-kontrol-et',p_value=>true);
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$
declare hit boolean:=false; id bigint:=current_setting('cx.test.comment')::bigint;
begin
 assert not (public.cx_community_read('android-izinlerini-kontrol-et',id-1)->'comments' @> jsonb_build_array(jsonb_build_object('id',id::text))),'pending comment hidden from others';
 assert jsonb_array_length(public.cx_community_read()->'bookmarks')=0,'bookmarks private';
 begin perform public.cx_community_write('delete',p_comment=>id); exception when insufficient_privilege then hit:=true; end;
 assert hit,'cannot delete another member comment';
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$
declare hit boolean:=false;
begin
 assert not (public.cx_community_read('android-izinlerini-kontrol-et',current_setting('cx.test.comment')::bigint-1)->'comments' @> jsonb_build_array(jsonb_build_object('id',current_setting('cx.test.comment')))),'anonymous cannot read pending';
 begin perform public.cx_community_write('profile',p_body=>'anonymous'); exception when insufficient_privilege then hit:=true; end;
 assert hit,'anonymous writes denied';
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$
declare id bigint:=current_setting('cx.test.comment')::bigint;
begin
 assert public.cx_community_read(p_after=>id-1,p_queue=>true)->'comments' @> jsonb_build_array(jsonb_build_object('id',id::text)),'moderator sees queue';
 perform public.cx_community_write('publish',p_comment=>id);
 perform public.cx_community_write('block',p_comment=>id);
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$
declare hit boolean:=false;
begin
 begin perform public.cx_community_write('profile',p_body=>'blocked user'); exception when insufficient_privilege then hit:=sqlerrm='member_blocked'; end;
 assert hit,'blocked account cannot write';
end $$;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
select public.cx_community_write('unblock',p_comment=>current_setting('cx.test.comment')::bigint);
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$
declare hit boolean:=false; a jsonb; id bigint:=current_setting('cx.test.comment')::bigint;
begin
 perform public.cx_community_write('profile',p_body=>'Second member');
 begin perform public.cx_community_write('comment','localsend-ile-dosya-aktarimi','cross-post',id); exception when others then hit:=sqlerrm='invalid_parent'; end;
 assert hit,'cross-post reply denied';
 a:=public.cx_community_write('comment','android-izinlerini-kontrol-et','A reply',id);
 perform set_config('cx.test.reply',a->>'id',true);
end $$;
reset role;
update cx_private.limits set last_at=now()-interval '1 hour' where user_id='22222222-2222-4222-8222-222222222222';
set local role authenticated;
do $$
declare hit boolean:=false;
begin
 begin perform public.cx_community_write('comment','android-izinlerini-kontrol-et','deep reply',current_setting('cx.test.reply')::bigint); exception when others then hit:=sqlerrm='invalid_parent'; end;
 assert hit,'reply depth bounded';
end $$;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
do $$
declare hit boolean:=false;
begin
 begin perform public.cx_community_write('profile',p_body=>'Unverified'); exception when insufficient_privilege then hit:=sqlerrm='login_required'; end;
 assert hit,'unverified member denied';
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select public.cx_community_write('delete',p_comment=>current_setting('cx.test.comment')::bigint);
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$
declare a jsonb;
begin
 a:=public.cx_community_read('android-izinlerini-kontrol-et',current_setting('cx.test.comment')::bigint-1);
 assert a->'comments' @> jsonb_build_array(jsonb_build_object('id',current_setting('cx.test.comment'),'body','[Yorum silindi]','status','deleted')),'delete removes comment body';
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$
declare hit boolean:=false;
begin
 for i in 2..10 loop
  update cx_private.limits set last_at=now()-interval '1 minute' where user_id=auth.uid() and bucket='comment';
  perform public.cx_community_write('comment','android-izinlerini-kontrol-et','Hourly test '||i);
 end loop;
 update cx_private.limits set last_at=now()-interval '1 minute' where user_id=auth.uid() and bucket='comment';
 begin perform public.cx_community_write('comment','android-izinlerini-kontrol-et','Eleventh'); exception when others then hit:=sqlerrm='rate_limited'; end;
 assert hit,'hourly limit rejects eleventh comment';
end $$;
rollback;
select 'PASS: anonymous, pending visibility, role escalation, cross-user deletion, private bookmarks, duplicate likes, moderation, block, rate limit, reply validation, unverified member and deletion' as result;
