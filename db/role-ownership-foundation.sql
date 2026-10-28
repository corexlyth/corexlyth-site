-- Foundation only: no new role is authorized by the existing application yet.
-- Existing drafts have unknown ownership; do not infer it from updated_by.
alter table cx_private.drafts
 add column author_id uuid references auth.users(id) on delete set null;
create index drafts_author_id on cx_private.drafts(author_id) where author_id is not null;

-- A verified editorial request creates its own authorship. Imported or otherwise
-- server-created rows with no user session remain unassigned for later review.
create function cx_private.capture_draft_author() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 new.author_id := auth.uid();
 return new;
end $$;
revoke all on function cx_private.capture_draft_author() from public, anon, authenticated;
create trigger capture_draft_author before insert on cx_private.drafts
 for each row execute function cx_private.capture_draft_author();

-- Future application roles, kept private and deliberately not connected to
-- editor/media/moderation capabilities until their access checks are upgraded.
create table cx_private.staff_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','moderator','author')),
 created_at timestamptz not null default now()
);
alter table cx_private.staff_roles enable row level security;
create policy deny_direct_client_access on cx_private.staff_roles
 for all to anon, authenticated using(false) with check(false);
revoke all on cx_private.staff_roles from public, anon, authenticated;
insert into cx_private.staff_roles(user_id,role)
 select user_id,'admin' from cx_private.content_roles where role='owner';
