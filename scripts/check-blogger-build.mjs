import assert from 'node:assert/strict';import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('src/config/blogger-import.json'));const feed=JSON.parse(fs.readFileSync('dist/content-manifest.json'));
for(const post of manifest.posts){
 const active=feed.publications.find(p=>p.slug===post.slug)?.active;const alias=new URL(post.sourceUrl).pathname.slice(1);
 if(!active){assert(!fs.existsSync('dist/'+alias),'Withdrawn/not-imported alias absent');continue;}
 const html=fs.readFileSync('dist/yazi/'+post.slug+'/index.html','utf8');
 assert(html.includes('datetime="'+post.published.slice(0,10)+'"'),'Original calendar date');
 for(const image of [post.cover,...post.images]){assert(fs.existsSync('dist/'+image),'Local image exists');assert(html.includes('/corexlyth-site/'+image),'Local image rendered');}
 assert(!/\[(?:KAPAK|KAPAK-KONUM|BÖLÜM|KARTLAR)\]/.test(html),'Blogger syntax converted');
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const m of html.matchAll(/href="#([^"]+)"/g))assert(ids.has(m[1]),'Fragment exists: '+m[1]);
 const redirect=fs.readFileSync('dist/'+alias,'utf8');assert(redirect.includes('/corexlyth-site/yazi/'+post.slug+'/'),'Alias points to article');assert(redirect.includes('location.search+location.hash'),'Alias preserves query and fragment');
}
console.log('Blogger dates, images, markup, fragments and legacy aliases verified.');
