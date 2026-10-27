#!/usr/bin/env python3
import sys,unittest
sys.path.insert(0,'scripts')
from lib.blogger import Tree,convert,cover_url
class BloggerConversion(unittest.TestCase):
 def test_directives_and_formatting(self):
  source='<p>[KAPAK] https://example.com/cover.jpg</p><p>[BÖLÜM] Bir başlık</p><p>Önce <strong>önemli</strong> metin.</p><p>[UYARI] Dikkat et.</p><p>[KARTLAR] Bir | İki</p>'
  result=convert(Tree(source).root,{},{});self.assertIn('## Bir başlık',result);self.assertIn('Önce **önemli** metin.',result);self.assertIn('> [!WARNING]\n> Dikkat et.',result);self.assertIn('- Bir\n- İki',result);self.assertNotIn('KAPAK',result)
 def test_plain_metadata_and_nested_div(self):
  source='[SERİ] Sistemler | 01<div>[KAPAK] https://example.com/a.jpg\n\n<p>Asıl yazı burada.</p></div>'
  root=Tree(source).root;self.assertEqual(cover_url(root),'https://example.com/a.jpg');result=convert(root,{},{});self.assertIn('> Sistemler | 01',result);self.assertIn('Asıl yazı burada.',result);self.assertNotIn('https://example.com',result)
 def test_images_captions_and_internal_links(self):
  source='<figure><img src="https://example.com/a.png" alt="Bir şema"><figcaption>Kaynak: <a href="https://example.com/license">CC BY-SA</a></figcaption></figure><p><a href="https://corexlyth.blogspot.com/2026/10/old.html?m=1#bolum">Devam</a></p>'
  result=convert(Tree(source).root,{'https://example.com/a.png':'assets/img/blogger/a.webp'},{'/2026/10/old.html':'/corexlyth-site/yazi/new/'})
  self.assertIn('![Bir şema](/corexlyth-site/assets/img/blogger/a.webp)',result);self.assertIn('[CC BY-SA](https://example.com/license)',result);self.assertIn('[Devam](/corexlyth-site/yazi/new/#bolum)',result)
 def test_footnotes_and_unsafe_html(self):
  source='<p>Bilgi<sup><a href="#kaynak-1">[1]</a></sup></p><ol><li id="kaynak-1">Kaynağın metni</li></ol><script>alert(1)</script><p><a href="javascript:alert(1)">Metin</a></p>'
  result=convert(Tree(source).root,{},{});self.assertIn('Bilgi[^kaynak-1]',result);self.assertIn('[^kaynak-1]: Kaynağın metni',result);self.assertNotIn('alert',result)
 def test_missing_image_fails(self):
  with self.assertRaises(ValueError):convert(Tree('<img src="missing.png">').root,{},{})
unittest.main()
