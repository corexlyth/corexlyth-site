import assert from 'node:assert/strict';import fs from 'node:fs';
const page=fs.readFileSync('dist/hesap/yazilar/index.html','utf8');
for(const mark of ['data-media-upload-cover','data-media-open-inline','data-media-open-gallery','data-inline-media-dialog','data-inline-media-file','data-media-alt'])assert(page.includes(mark));
assert(!page.includes('data-media-upload-inline'));
assert(!page.includes('data-media-use-inline'));assert(!page.includes('data-media-list'));assert(!page.includes('data-media-use-cover'));assert.equal((page.match(/name="cover"/g)||[]).length,1);assert.equal((page.match(/name="coverAlt"/g)||[]).length,1);assert(!page.includes('<select name="cover"'));assert(!page.includes('type="date"'));
assert(page.includes('image/jpeg,image/png,image/webp,image/avif'));
for(const post of fs.readdirSync('.cache/blog').filter(x=>x.endsWith('.md'))){const html=fs.readFileSync(`dist/yazi/${post.slice(0,-3)}/index.html`,'utf8');assert(!html.includes('data-media-file'));}
console.log('PASS: editor-only media controls, explicit image input types and no upload controls on public articles');
