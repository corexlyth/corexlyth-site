import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const home=read('dist/index.html');
assert.doesNotMatch(home,/cx-home-query/,'Homepage must not show the search box');

for(const file of readdirSync('.cache/blog').filter(f=>f.endsWith('.md'))){
 const source=read(`.cache/blog/${file}`);
 if(/^draft:\s*true\s*$/m.test(source))continue;
 const slug=file.slice(0,-3),page=read(`dist/yazi/${slug}/index.html`);

 assert.match(page,/data-community="article"/);
 assert.ok(!page.includes('data-profile-form'),'Article must not include the nickname editor');
 assert.ok(!page.includes('data-moderation-link'),'Article must not include moderation navigation');
 assert.match(page,/data-pagefind-ignore/);
 assert.ok(page.includes(`data-post="${slug}"`));
}
for(const route of ['hesap/','hesap/moderasyon/']){
 const page=read(`dist/${route}index.html`);
 assert.match(page,/data-community=/);
 assert.match(page,/noindex/);
 assert.ok(!read('dist/sitemap-0.xml').includes(`/${route}`));
}
console.log('PASS: homepage search, community routes, trusted post registry and account indexing boundaries');
