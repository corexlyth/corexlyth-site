import { readFile, writeFile, readdir, mkdir, rm, rename, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { validContent } from '../src/lib/content-rules.ts';
const config=JSON.parse(await readFile('src/config/public-auth.json','utf8'));
const client=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:feed,error}=await client.rpc('cx_content_feed');
if(error) throw new Error('Published content feed unavailable; the existing site is left intact. '+error.message);
if(feed?.schema!==1 || !Array.isArray(feed.posts) || feed.posts.length>5000)throw new Error('Invalid publication feed');
const records=new Map();
for(const file of await readdir('src/content/blog'))if(file.endsWith('.md'))records.set(file.slice(0,-3),await readFile('src/content/blog/'+file,'utf8'));
for(const post of feed.posts){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)||post.slug.length>160)throw new Error('Invalid publication slug');
 if(!post.active){records.delete(post.slug);continue;}
 const p=post.payload;
 if(!validContent(p))throw new Error('Invalid published payload for '+post.slug);
 if(!existsSync('public/'+p.cover))throw new Error('Missing cover asset for '+post.slug);
 const meta={...p};delete meta.body;meta.draft=false;
 const front=Object.entries(meta).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join('\n');
 records.set(post.slug,`---\n${front}\n---\n\n${p.body}\n`);
}
await mkdir('.cache',{recursive:true});await rm('.cache/blog-next',{recursive:true,force:true});await mkdir('.cache/blog-next');
for(const [slug,body] of records)await writeFile(`.cache/blog-next/${slug}.md`,body);
await rm('.cache/blog',{recursive:true,force:true});await rename('.cache/blog-next','.cache/blog');
const hash=createHash('sha256').update(JSON.stringify(feed)).digest('hex');
let previous;try{previous=JSON.parse(await readFile('public/content-manifest.json','utf8')).hash;}catch{}
await writeFile('public/content-manifest.json',JSON.stringify({schema:1,hash,publications:feed.posts.map(({slug,revision,active})=>({slug,revision,active}))})+'\n');
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`changed=${hash!==previous}\n`);
console.log(`Prepared ${records.size} public articles; publication changed: ${hash!==previous}. No drafts fetched.`);
