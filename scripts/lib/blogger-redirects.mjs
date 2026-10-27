import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
export async function bloggerRedirects(manifest,records,output='public') {
 // Only this migration's exact known aliases are written. They are client redirects,
 // not HTTP 301s, and cannot change URLs hosted on blogspot.com.
 const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 for(const post of manifest.posts){
  const source=new URL(post.sourceUrl);
  if(source.hostname!=='corexlyth.blogspot.com'||!/^\/20\d{2}\/(0[1-9]|1[0-2])\/[a-z0-9_-]+\.html$/.test(source.pathname)||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug))throw new Error('Invalid Blogger route');
  const filename=path.join(output,source.pathname.slice(1));
  if(!records.has(post.slug)){await rm(filename,{force:true});continue;}
  const target='/corexlyth-site/yazi/'+post.slug+'/';
  const canonical='https://corexlyth.github.io'+target;
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, follow"><link rel="canonical" href="${esc(canonical)}"><meta http-equiv="refresh" content="0; url=${esc(target)}"><title>Yazı taşındı | CoreXLyth</title></head><body><p>Bu yazı yeni adresinde: <a href="${esc(target)}">${esc(post.title||'Yazıya git')}</a></p><script>location.replace(${JSON.stringify(target)}+location.search+location.hash)</script></body></html>\n`;
  await mkdir(path.dirname(filename),{recursive:true});await writeFile(filename,html);
 }
}
