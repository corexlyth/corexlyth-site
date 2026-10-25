import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url).pathname;
const dist = join(root,'dist');
const source = join(root,'src','content','blog');
const markdown = readdirSync(source).filter(file=>file.endsWith('.md'));
const essential=[
 'index.html','404.html','arsiv/index.html',
 'assets/css/main.css','assets/js/main.js',
 'assets/img/corexlyth-apps.svg','assets/img/corexlyth-code.svg',
 'assets/img/corexlyth-featured.svg','assets/img/corexlyth-lab.svg'
];
let failures=0;
function assert(ok,message){console.log(`${ok?'PASS':'FAIL'}: ${message}`);if(!ok)failures++;}
for(const file of essential)assert(existsSync(join(dist,file)),`Output contains ${file}`);
for(const file of markdown) {
 const slug=file.slice(0,-3);
 const path=`yazi/${slug}/index.html`;
 assert(existsSync(join(dist,path)),`Article page ${path}`);
 if(existsSync(join(dist,path))) {
  const html=readFileSync(join(dist,path),'utf8');
  assert(html.includes('class="cx-article'),`Article frame ${slug}`);
  assert(html.includes('og:type" content="article"'),`Open Graph article ${slug}`);
 }
}
if(existsSync(join(dist,'index.html'))){
 const html=readFileSync(join(dist,'index.html'),'utf8');
 for(const mark of ['KEŞİF','TÜM KAYITLAR','NEURAL INTERFACE','cx-hud-frame',
   '/corexlyth-site/assets/css/main.css','/corexlyth-site/assets/js/main.js',
   '<link rel="canonical"','name="description"'])
   assert(html.includes(mark),`Homepage contains ${mark}`);
 for(const file of markdown)
   assert(html.includes(`/corexlyth-site/yazi/${file.slice(0,-3)}/`),`Homepage links to ${file}`);
 assert(!html.includes('11 YAYIN'),'No inaccurate placeholder publication count');
 assert(!html.includes('href="#"'),'No dead placeholder links');
 assert(!html.includes('src="./assets/'),'No broken asset URLs');
}
for(const slug of ['dijital-dunya','uygulamalar','rehberler'])
 assert(existsSync(join(dist,`kategori/${slug}/index.html`)),`Category page ${slug}`);
for(const slug of ['android','web-gelistirme','acik-kaynak','erisilebilirlik'])
 assert(existsSync(join(dist,`etiket/${slug}/index.html`)),`Tag page ${slug}`);
assert(markdown.length>=5,'At least five real Markdown records exist');

const SEO_FILES=['ara/index.html','rss.xml','robots.txt','sitemap-index.xml','sitemap-0.xml','assets/js/search.js','pagefind/pagefind.js'];
for(const file of SEO_FILES)assert(existsSync(join(dist,file)),`Search/SEO output ${file}`);
if(existsSync(join(dist,'rss.xml'))) {
 const xml=readFileSync(join(dist,'rss.xml'),'utf8');
 assert(xml.includes('LocalSend'),'RSS includes published LocalSend post');
 assert(xml.includes('/corexlyth-site/yazi/'),'RSS links use project base path');
}
if(existsSync(join(dist,'robots.txt'))){
 const text=readFileSync(join(dist,'robots.txt'),'utf8');
 assert(text.includes('https://corexlyth.github.io/corexlyth-site/sitemap-index.xml'),'Robots lists exact sitemap');
}
if(existsSync(join(dist,'sitemap-0.xml'))){
 const xml=readFileSync(join(dist,'sitemap-0.xml'),'utf8');
 assert(xml.includes('/corexlyth-site/yazi/'),'Sitemap contains article pages');
 assert(!xml.includes('/ara/'),'Sitemap excludes noindex search page');
}
if(existsSync(join(dist,'ara/index.html'))){
 const html=readFileSync(join(dist,'ara/index.html'),'utf8');
 assert(html.includes('cx-search-input'),'Search page includes input');
 assert(html.includes('assets/js/search.js'),'Search page loads client search');
 assert(html.includes('noindex'),'Search page excluded from index');
}
for(const file of markdown){
 const path=`yazi/${file.slice(0,-3)}/index.html`;
 if(!existsSync(join(dist,path)))continue;
 const html=readFileSync(join(dist,path),'utf8');
 assert(html.includes('data-pagefind-body'),'Article indexed for search: '+file);
 assert(html.includes('BlogPosting'),'Article schema structured metadata: '+file);
}
if(existsSync(join(dist,'index.html'))){
 const html=readFileSync(join(dist,'index.html'),'utf8');
 assert(html.includes('/corexlyth-site/ara/'),'Home navigation to search');
 assert(html.includes('/corexlyth-site/rss.xml'),'RSS discovery tag');
}

if(failures){console.error(`CoreXLyth verification failed: ${failures} errors`);process.exitCode=1;}
else console.log('CoreXLyth content build verified.');
