import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderArticleMarkdown as render} from '../src/lib/article-markdown.ts';
const image='![Birinci fotoğraf](/corexlyth-site/assets/img/corexlyth-lab.svg)';
for(const [type,label] of Object.entries({NOTE:'Not',INFO:'Bilgi',TIP:'İpucu',WARNING:'Uyarı',IMPORTANT:'Önemli',DETAILS:'Ayrıntılar'})){
 const html=await render(`> [!${type}]\n> Açıklama **vurgulu**\n>\n> - İç madde`);
 assert(html.includes(`cx-callout--${type.toLowerCase()}`));assert(html.includes(label));assert(html.includes('<strong>vurgulu</strong>'));assert(html.includes('<li>İç madde</li>'));assert(!html.includes(`[!${type}]`));
 if(type==='DETAILS')assert(html.includes('<summary'));
}
const gallery=await render(`> [!GALLERY]\n> ${image}\n>\n> ![İkinci fotoğraf](/b.webp)`);
assert(gallery.includes('class="cx-gallery"'));assert.equal((gallery.match(/class="cx-gallery__item"/g)||[]).length,2);assert.equal((gallery.match(/<figcaption>/g)||[]).length,2);
const mixed=await render(`> [!GALLERY]\n> ${image}\n>\n> Saklanması gereken metin`);assert(mixed.includes('Saklanması gereken metin'));assert(!mixed.includes('class="cx-gallery"'));
assert((await render(image)).includes('<figure class="cx-figure">'));
const regular=await render('## Bölüm\n\n- Üst madde\n  - Alt madde\n\n- [x] Tamam\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```text\n<örnek>\n```');
assert(regular.includes('<h2>Bölüm</h2>'));assert(regular.includes('Alt madde'));assert(regular.includes('disabled'));assert(regular.includes('cx-table-scroll'));assert(regular.includes('<code'));
const unsafe=await render('<script>window.xss=1</script>\n\n[Tehlikeli](javascript:alert(1))\n\n![Görsel](javascript:alert(1))\n\n> [!NOTE] <img src=x onerror=alert(1)>\n> Güvenli içerik');
assert(!unsafe.includes('<script>'));assert(!unsafe.includes('<img src=x'));assert(!unsafe.includes('href="javascript:'));assert(!unsafe.includes('src="javascript:'));assert(unsafe.includes('&#x3C;script>'));
const editor=fs.readFileSync('dist/hesap/yazilar/index.html','utf8');for(const kind of ['h2','h3','list','ordered','check','note','info','warning','tip','important','details','table','code'])assert(editor.includes(`data-write-block="${kind}"`));
console.log('PASS: shared article blocks, gallery captions, details, GFM, literal HTML safety and toolbar controls');
