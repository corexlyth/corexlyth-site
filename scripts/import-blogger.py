#!/usr/bin/env python3
"""Prepare an inspectable import. Never connects to or writes a database.
Usage: python scripts/import-blogger.py /path/feed.json /path/staging
Requires Pillow only for local image conversion. Assets are written to staging/assets.
"""
import concurrent.futures,hashlib,io,json,pathlib,re,sys,urllib.request
from urllib.parse import urlsplit,unquote
from PIL import Image,ImageOps
from lib.blogger import Tree,cover_url,convert,plain
source=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);(out/'assets').mkdir(exist_ok=True)
feed=json.loads(source.read_text())['feed'];entries=feed.get('entry',[])
assert len(entries)==int(feed['openSearch$totalResults']['$t']), 'Incomplete Blogger feed; paginate before importing'
posts=[];urls={};image_urls=set()
for p in entries:
 url=next(x['href'] for x in p['link'] if x['rel']=='alternate');path=unquote(urlsplit(url).path);slug=path.split('/')[-1].removesuffix('.html').replace('_','-')
 assert re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*',slug) and len(slug)<=160
 assert slug not in [x['slug'] for x in posts]
 root=Tree(p['content']['$t']).root;cover=cover_url(root);assert cover
 images=[x.attrs['src'] for x in root.find('img')];image_urls.update(images+[cover]);urls[path]='/corexlyth-site/yazi/'+slug+'/'
 posts.append(dict(slug=slug,sourceId=p['id']['$t'],sourceUrl=url,published=p['published']['$t'],updated=p['updated']['$t'],root=root,cover=cover,images=images,entry=p))
def image(url):
 assert urlsplit(url).scheme=='https' and urlsplit(url).hostname in ('corexlyth.github.io','commons.wikimedia.org','upload.wikimedia.org','localsend.org','blogger.googleusercontent.com'),url
 name=hashlib.sha256(url.encode()).hexdigest()[:24]+'.webp';dest=out/'assets'/name
 if not dest.exists():
  request=urllib.request.Request(url,headers={'User-Agent':'CoreXLythMigration/1.0 (site-owner content transfer)'})
  with urllib.request.urlopen(request,timeout=30) as response: data=response.read(20000001)
  assert len(data)<=20000000,'Image too large'
  im=ImageOps.exif_transpose(Image.open(io.BytesIO(data)));assert im.width*im.height<=80000000
  im.thumbnail((1920,1920),Image.Resampling.LANCZOS);im.convert('RGB').save(dest,'WEBP',quality=86)
 return url,'assets/img/blogger/'+name
assets={};fail=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 futures={pool.submit(image,url):url for url in sorted(image_urls)}
 for f in concurrent.futures.as_completed(futures):
  try:url,path=f.result();assets[url]=path
  except Exception as e:fail.append(dict(url=futures[f],error=str(e)))
(out/'image-errors.json').write_text(json.dumps(fail,ensure_ascii=False,indent=2))
if fail:print('Image failures:',len(fail));sys.exit(1)
manifest=[];payloads=[]
for post in posts:
 p=post.pop('entry');root=post.pop('root');cover=post.pop('cover');images=post.pop('images')
 tags=[x['term'] for x in p.get('category',[]) if not x['term'].startswith('_music_')]
 category='Tarih' if 'Tarih' in tags else 'Görünmeyen Sistemler' if 'Görünmeyen Sistemler' in tags else 'Teknoloji'
 body=convert(root,assets,urls)
 # First substantive paragraph supplies the archive excerpt, never metadata/directives.
 candidates=[plain(n.text()) for n in root.find('p') if not plain(n.text()).startswith('[') and len(plain(n.text()))>=60 and not n.find('img')]
 description=(candidates[0] if candidates else p['title']['$t'])[:217].rsplit(' ',1)[0]+'…'
 payload=dict(title=p['title']['$t'],description=description,body=body,category=category,tags=tags,cover=assets[cover],coverAlt=p['title']['$t'],pubDate=post['published'][:10],featured=False)
 payloads.append(dict(slug=post['slug'],payload=payload,published=post['published']))
 manifest.append({**post,'title':payload['title'],'cover':assets[cover],'images':[assets[x] for x in images],'sourceHash':hashlib.sha256(p['content']['$t'].encode()).hexdigest()})
 (out/(post['slug']+'.md')).write_text('---\n'+'\n'.join(k+': '+json.dumps(v,ensure_ascii=False) for k,v in payload.items() if k!='body')+'\n---\n\n'+body)
(out/'payloads.json').write_text(json.dumps(payloads,ensure_ascii=False,indent=2))
(out/'manifest.json').write_text(json.dumps(dict(schema=1,source='https://corexlyth.blogspot.com/',posts=manifest,assets=assets),ensure_ascii=False,indent=2)+'\n')
print('Prepared',len(posts),'posts;',len(assets),'local images. No database writes.')
