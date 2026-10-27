#!/usr/bin/env python3
"""Generate an owner-reviewed SQL transaction from prepared, public-only payloads.
Never authenticates or executes SQL. A changed existing draft aborts the entire import.
"""
import json,pathlib,sys
rows=json.loads(pathlib.Path(sys.argv[1]).read_text())
manifest=json.loads(pathlib.Path(sys.argv[2]).read_text());sources={p['slug']:p for p in manifest['posts']}
for row in rows:row['source']=sources[row['slug']]['sourceUrl'];row['sourceId']=sources[row['slug']]['sourceId'];row['sourceHash']=sources[row['slug']]['sourceHash']
data=json.dumps(rows,ensure_ascii=False);assert '$cx_import$' not in data
print('''begin;
do $migration$
declare row jsonb; payload jsonb; slug_value text; owner_id uuid; existing cx_private.drafts; count_owner integer;
begin
 select count(*),min(user_id::text)::uuid into count_owner,owner_id from cx_private.content_roles where role='owner';
 if count_owner<>1 then raise exception 'Expected exactly one publishing owner'; end if;
 for row in select * from jsonb_array_elements($cx_import$'''+data+'''$cx_import$::jsonb) loop
  slug_value:=row->>'slug';payload:=row->'payload';
  if slug_value !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or payload->>'cover' !~ '^assets/img/blogger/[a-f0-9]{24}\\.webp$' then raise exception 'Invalid Blogger payload';end if;
  perform pg_advisory_xact_lock(hashtextextended(slug_value,526));
  select * into existing from cx_private.drafts where slug=slug_value for update;
  if found then
   if existing.payload=payload and exists(select 1 from cx_private.content_history h where h.slug=slug_value and h.action='blogger_import' and h.payload->>'sourceId'=row->>'sourceId') then continue;end if;
   raise exception 'Existing draft would be overwritten: %',slug_value;
  end if;
  insert into cx_private.drafts(slug,payload,revision,updated_by) values(slug_value,payload,1,owner_id);
  insert into cx_private.publications(slug,payload,revision,published_at) values(slug_value,payload,1,(row->>'published')::timestamptz);
  insert into cx_private.posts(slug,title,active) values(slug_value,payload->>'title',true);
  insert into cx_private.content_history(slug,revision,action,payload,actor) values(slug_value,1,'blogger_import',row,owner_id);
 end loop;
end $migration$;
commit;''')
