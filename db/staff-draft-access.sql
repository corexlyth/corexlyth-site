-- Authorization primitive for the future editor and moderation endpoints.
-- This migration intentionally does not grant new roles any API access.
create function cx_private.staff_draft_allowed(p_action text, p_slug text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare u uuid; r text; author uuid;
begin
 u := cx_private.require_member();
 select role into r from cx_private.staff_roles where user_id = u;
 if r is null or p_action not in ('edit', 'delete') then return false; end if;
 select author_id into author from cx_private.drafts where slug = p_slug;
 if not found then return false; end if;
 if r = 'admin' then return true; end if;
 if p_action = 'delete' and r = 'moderator' then return true; end if;
 return coalesce(p_action = 'edit' and r in ('moderator', 'author') and author = u, false);
end $$;
revoke all on function cx_private.staff_draft_allowed(text,text) from public,anon,authenticated;
