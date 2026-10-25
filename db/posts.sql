-- Published Markdown registry. Run through the trusted publishing workflow when posts change.
insert into cx_private.posts(slug,title) values
('android-izinlerini-kontrol-et','Android uygulama izinleri: Gereksiz erişimleri nasıl azaltırsın?'),
('corexlyth-bagimsiz-yayin-donemi','CoreXLyth’in bağımsız yayın dönemi: Yeni sitede neler değişiyor?'),
('github-pages-ile-bagimsiz-site','GitHub Pages ile bağımsız web sitesi kurmak mümkün mü?'),
('localsend-ile-dosya-aktarimi','LocalSend ile telefon ve bilgisayar arasında dosya gönderme'),
('site-tasariminda-erisebilirlik','Cyberpunk web tasarımında erişilebilirlik neden önemli?')
on conflict(slug) do update set title=excluded.title,active=true;
