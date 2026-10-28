-- Internal authorization primitive only. This does not ban users and is not
-- callable from the public API. Auth admin operations need a trusted service.
create function cx_private.account_ban_allowed(p_target uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; actor_role text; target_role text;
begin
 actor:=cx_private.require_member();
 select role into actor_role from cx_private.staff_roles where user_id=actor;
 if actor_role is null or actor_role not in ('admin','moderator') or p_target is null or p_target=actor then return false; end if;
 if not exists(select 1 from auth.users where id=p_target and is_anonymous is not true) then return false; end if;
 select role into target_role from cx_private.staff_roles where user_id=p_target;
 if target_role='admin' or (actor_role='moderator' and target_role='moderator') then return false; end if;
 return true;
end $$;
revoke all on function cx_private.account_ban_allowed(uuid) from public,anon,authenticated;
