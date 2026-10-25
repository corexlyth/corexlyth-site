import assert from 'node:assert/strict';import fs from 'node:fs';
import {validContent,validSlug} from '../src/lib/content-rules.ts';
const p={title:'Geçerli yazı başlığı',description:'Otuz beş karakterden uzun, geçerli bir açıklama metni.',body:'Markdown yazısı.',pubDate:'2026-10-25',category:'Rehberler',tags:['Test'],cover:'assets/img/corexlyth-code.svg',coverAlt:'Test kapağı',featured:false};
assert(validContent(p));assert(!validContent({...p,pubDate:'2026-02-30'}));assert(!validContent({...p,cover:'assets/img/../../secret.svg'}));assert(!validContent({...p,tags:['a']}));assert(!validSlug('../escape'));assert(validSlug('gecerli-yazi'));
const html=fs.readFileSync('dist/hesap/yazilar/index.html','utf8');assert(html.includes('noindex'));assert(!html.includes('data-pagefind-body'));assert(html.includes('data-editor-form'));
assert(!fs.readFileSync('dist/sitemap-0.xml','utf8').includes('/hesap/yazilar/'));
const feed=JSON.parse(fs.readFileSync('dist/content-manifest.json','utf8'));assert(feed.hash&&Array.isArray(feed.publications));
console.log('PASS: editor input limits, address safety, private route indexing and deployed publication manifest');
