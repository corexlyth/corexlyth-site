"""Conservative Blogger HTML → the editor's safe Markdown. Standard library only."""
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
class Node:
 def __init__(self,tag='',attrs=(),parent=None): self.tag=tag;self.attrs=dict(attrs);self.children=[];self.parent=parent
 def text(self): return ''.join(c if isinstance(c,str) else c.text() for c in self.children)
 def find(self,tag):
  return [c for c in self.children if isinstance(c,Node) and c.tag==tag]+[d for c in self.children if isinstance(c,Node) for d in c.find(tag)]
class Tree(HTMLParser):
 def __init__(self,html):
  super().__init__(convert_charrefs=True);self.root=Node();self.current=self.root;self.feed(html)
 def handle_starttag(self,tag,attrs):
  # Blogger occasionally nests <p> tags; use HTML paragraph closure semantics.
  if tag=='p' and self.current.tag=='p': self.current=self.current.parent
  n=Node(tag,attrs,self.current);self.current.children.append(n)
  if tag not in ('img','br','hr','input','meta','link','source','wbr'): self.current=n
 def handle_startendtag(self,tag,attrs): self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  n=self.current
  while n.parent:
   if n.tag==tag: self.current=n.parent;return
   n=n.parent
 def handle_data(self,s): self.current.children.append(s)
def escape(s): return re.sub(r'([\\`*\[\]<>])',r'\\\1',s)
def plain(s): return re.sub(r'\s+',' ',s).strip()
def blocks(s): return re.sub(r'\n{3,}','\n\n',s).strip()
def cover_url(root):
 m=re.search(r'\[KAPAK\]\s*(https?://[^\s<>]+)',root.text())
 return m.group(1) if m else (root.find('img')[0].attrs.get('src') if root.find('img') else None)
def convert(root,assets,links):
 def render(n):
  if isinstance(n,str):
   # Directives can be plain text siblings, not only paragraphs.
   return '\n\n'.join(directive(escape(plain(x))) for x in n.split('\n\n') if plain(x))
  tag=n.tag
  if tag in ('script','style','iframe','object'): return ''
  if tag=='img':
   src=n.attrs.get('src','');alt=plain(n.attrs.get('alt','')) or 'Yazı içi görsel'
   if src not in assets: raise ValueError('Unresolved image '+src)
   return '\n\n!['+escape(alt)+'](/corexlyth-site/'+assets[src]+')\n\n'
  if tag=='br': return '\n'
  if tag=='hr': return '\n\n---\n\n'
  if tag=='sup' and n.find('a'):
   href=n.find('a')[0].attrs.get('href','')
   if href.startswith('#kaynak-'): return '[^'+href[1:]+']'
  # Inline spaces matter: normalize only text nodes here, never concatenate stripped words.
  def children():
   return ''.join((render(c) if tag in ('','div') else escape(re.sub(r'\s+',' ',c))) if isinstance(c,str) else render(c) for c in n.children)
  body=children()
  if tag in ('strong','b'): return '**'+body.strip()+'**' if body.strip() else ''
  if tag in ('em','i'): return '*'+body.strip()+'*' if body.strip() else ''
  if tag=='code': return '`'+body.strip().replace('`','\\`')+'`'
  if tag=='a':
   if n.find('img'): return body
   href=n.attrs.get('href','');parts=urlsplit(href)
   if parts.scheme and parts.scheme not in ('https','http','mailto'): return body
   key=unquote(parts.path)
   if parts.hostname in ('corexlyth.blogspot.com','corexlyth.blogspot.com.tr') and key in links: href=links[key]+('#'+parts.fragment if parts.fragment else '')
   return '['+body.strip()+']('+href.replace(' ','%20')+')' if href else body
  if tag in ('h1','h2','h3','h4','h5','h6'): return '\n\n'+'#'*max(2,int(tag[1]))+' '+plain(body)+'\n\n'
  if tag=='p': return '\n\n'+directive(body.strip())+'\n\n' if body.strip() else '\n\n'
  if tag=='blockquote': return '\n\n'+quote(blocks(body))+'\n\n'
  if tag=='li':
   if n.attrs.get('id','').startswith('kaynak-'): return '\n\n[^'+n.attrs['id']+']: '+blocks(body).replace('\n','\n    ')+'\n\n'
   marker=str([c for c in n.parent.children if isinstance(c,Node) and c.tag=='li'].index(n)+1)+'.' if n.parent.tag=='ol' else '-'
   return '\n'+marker+' '+blocks(body).replace('\n','\n  ')+'\n'
  if tag in ('ul','ol','figure','figcaption','div',''): return '\n\n'+blocks(body)+'\n\n'
  return body
 def quote(s): return '\n'.join('> '+line if line else '>' for line in s.split('\n'))
 def directive(s):
  m=re.match(r'^\\?\[([^\]]+)\\?\]\s*(.*)$',s,re.S)
  if not m:return s
  kind=m[1].rstrip('\\');value=m[2]
  if kind in ('KAPAK','KAPAK-KONUM','DURUM'): return ''
  if kind=='BÖLÜM': return '## '+value
  if kind=='KARTLAR': return '\n'.join('- '+x.strip() for x in value.split('|') if x.strip())
  if kind=='KAYNAK':
   fields=[x.strip() for x in value.split('|')]
   if fields[-1].startswith('https://'):return '['+' — '.join(fields[:-1])+']('+fields[-1]+')'
  kinds={'NOT':'NOTE','BİLGİ':'INFO','UYARI':'WARNING','TERM':'INFO','SERİ':'INFO','SÖZ':None}
  if kind in kinds:return quote(('[!'+kinds[kind]+']'+(' Seri' if kind=='SERİ' else '')+'\n' if kinds[kind] else '')+value)
  return s
 return blocks(render(root))+'\n'
