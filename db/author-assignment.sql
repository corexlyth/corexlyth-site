create table cx_private.author_assignment_audit (
 id bigint generated always as identity primary key,
 slug text not null, actor_id uuid references auth.users(id) on delete set null,
 author_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table cx_private.author_assignment_audit enable row level security;
create policy deny_direct_client_access on cx_private.author_assignment_audit for all to anon,authenticated using(false) with check(false);
revoke all on cx_private.author_assignment_audit from public,anon,authenticated;
revoke all on sequence cx_private.author_assignment_audit_id_seq from public,anon,authenticated;

create function cx_private.author_assignment(p_action text,p_slug text default null,p_author uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb; candidates jsonb;
begin
 actor:=cx_private.require_member();
 if not exists(select 1 from cx_private.staff_roles where user_id=actor and role='admin') then raise exception using errcode='42501',message='admin_required';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.slug),'[]'::jsonb) into items from (
   select d.slug,d.payload->>'title' title,coalesce(p.active,false) published
   from cx_private.drafts d left join cx_private.publications p on p.slug=d.slug
   where d.author_id is null and d.deleted_at is null order by d.slug limit 100
  ) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.email,x.id),'[]'::jsonb) into candidates from (
   select u.id,u.email,s.role from cx_private.staff_roles s join auth.users u on u.id=s.user_id
   where u.email_confirmed_at is not null and u.is_anonymous is not true and (u.banned_until is null or u.banned_until<=now())
   and not exists(select 1 from cx_private.members m where m.user_id=u.id and m.blocked)
   order by u.email,u.id limit 100
  ) x;
  return jsonb_build_object('posts',items,'authors',candidates);
 elsif p_action='assign' then
  if p_slug is null or p_author is null then raise exception 'invalid_request';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_slug,526));
  if not exists(select 1 from cx_private.staff_roles s join auth.users u on u.id=s.user_id where s.user_id=p_author and u.email_confirmed_at is not null and u.is_anonymous is not true and (u.banned_until is null or u.banned_until<=now()) and not exists(select 1 from cx_private.members m where m.user_id=u.id and m.blocked)) then raise exception 'invalid_author';end if;
  update cx_private.drafts set author_id=p_author where slug=p_slug and author_id is null and deleted_at is null;
  if not found then raise exception 'post_unavailable';end if;
  insert into cx_private.author_assignment_audit(slug,actor_id,author_id) values(p_slug,actor,p_author);
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function cx_private.author_assignment(text,text,uuid) from public,anon,authenticated;
grant execute on function cx_private.author_assignment(text,text,uuid) to authenticated;
create function public.cx_author_assignment(p_action text,p_slug text default null,p_author uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select cx_private.author_assignment(p_action,p_slug,p_author)$$;
revoke all on function public.cx_author_assignment(text,text,uuid) from public,anon,authenticated;
grant execute on function public.cx_author_assignment(text,text,uuid) to authenticated;
notify pgrst,'reload schema';
