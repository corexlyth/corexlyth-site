create or replace function cx_private.staff_admin(p_action text, p_user uuid default null, p_role text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; old_role text; found_user boolean; result jsonb;
begin
 actor:=cx_private.require_member();
 if not exists(select 1 from cx_private.staff_roles where user_id=actor and role='admin') then
  raise exception using errcode='42501',message='admin_required';
 end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) into result from (
   select u.id,u.email,u.created_at,s.role,coalesce(m.blocked,false) blocked,u.banned_until,
    (cr.user_id is not null and (cr.expires_at is null or cr.expires_at>now())) comment_restricted,cr.expires_at comment_restriction_until,
    p.display_name from auth.users u
   left join cx_private.staff_roles s on s.user_id=u.id
   left join cx_private.members m on m.user_id=u.id
   left join cx_private.comment_restrictions cr on cr.user_id=u.id
   left join cx_private.profiles p on p.user_id=u.id
   where u.is_anonymous is not true order by u.created_at desc,u.id limit 100
  ) x;
  return jsonb_build_object('users',result);
 elsif p_action='set_role' then
  if p_user is null or p_user=actor or (p_role is not null and p_role not in ('admin','moderator','author')) then raise exception 'invalid_role_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('staff_role:'||p_user::text,0));
  select exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and is_anonymous is not true) into found_user;
  if not found_user then raise exception 'eligible_user_not_found'; end if;
  select role into old_role from cx_private.staff_roles where user_id=p_user;
  if old_role is not distinct from p_role then return jsonb_build_object('ok',true,'changed',false); end if;
  if p_role is null then delete from cx_private.staff_roles where user_id=p_user;
  else insert into cx_private.staff_roles(user_id,role) values(p_user,p_role) on conflict(user_id) do update set role=excluded.role; end if;
  insert into cx_private.members(user_id,moderator) values(p_user,coalesce(p_role in ('admin','moderator'),false))
   on conflict(user_id) do update set moderator=excluded.moderator;
  insert into cx_private.staff_role_audit(actor_id,target_id,previous_role,new_role) values(actor,p_user,old_role,p_role);
  return jsonb_build_object('ok',true,'changed',true);
 end if;
 raise exception 'invalid_action';
end $$;

notify pgrst,'reload schema';
