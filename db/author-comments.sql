-- Authenticated writers can read published comments only on their own live posts.
create function cx_private.author_comments() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; entries jsonb;
begin
 actor:=cx_private.require_member();
 if not exists(select 1 from cx_private.staff_roles where user_id=actor and role in ('author','moderator','admin')) then
  raise exception using errcode='42501',message='editor_required';
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into entries from (
  select c.id::text id,c.post_slug slug,p.title,c.body,c.created_at,coalesce(pr.display_name,'Anonim') name
  from cx_private.comments c
  join cx_private.drafts d on d.slug=c.post_slug and d.author_id=actor
  join cx_private.posts p on p.slug=c.post_slug and p.active
  left join cx_private.profiles pr on pr.user_id=c.user_id
  where c.status='published' order by c.created_at desc,c.id desc limit 50
 ) x;
 return jsonb_build_object('comments',entries);
end $$;
revoke all on function cx_private.author_comments() from public,anon,authenticated;
grant execute on function cx_private.author_comments() to authenticated;
create function public.cx_author_comments() returns jsonb language sql stable security invoker set search_path='' as $$select cx_private.author_comments()$$;
revoke all on function public.cx_author_comments() from public,anon,authenticated;
grant execute on function public.cx_author_comments() to authenticated;
notify pgrst,'reload schema';
