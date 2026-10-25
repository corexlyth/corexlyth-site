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
if(failures){console.error(`CoreXLyth verification failed: ${failures} errors`);process.exitCode=1;}
else console.log('CoreXLyth content build verified.');
