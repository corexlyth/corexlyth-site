# CoreXLyth yayın yönetimi

Panel: `/hesap/yazilar/`. Hesabım bölümünde bağlantı yalnızca içerik yetkisi olan hesaplarda görünür. Mevcut doğrulanmış site sahibi hesabı `owner` olarak atanmıştır; yorum moderatörlüğü bu yetkiyi otomatik vermez. `editor` taslak düzenler, `owner` yayımlar/yayından kaldırır. Rol ataması şimdilik güvenilen proje yönetiminden yapılır.

## Günlük akış

1. Yeni yazı aç veya listeden bir yazı seç.
2. Adres, başlık, açıklama, tarih, kategori, etiket, mevcut kapak ve Markdown gövdesini düzenle.
3. Önizleme tarayıcıda hazırlanır; taslağı yayımlamaz. HTML/tehlikeli URL'ler güvenli hale getirilir. Statik yayın ayrıca Markdown AST/HTML temizliğinden geçer.
4. Taslağı kaydet. Bu veri yalnızca özel DB'dedir; GitHub'a/derleme çıktısına gönderilmez.
5. Kaydedilmiş sürümü yayımla. Yalnızca açıkça yayımlanan kopya herkese açık `cx_content_feed` akışına eklenir. Sonraki taslak düzenlemeleri yayındaki kopyayı değiştirmez.
6. Site UTC dakikaları 7,22,37,52'de yayın değişikliklerini kontrol eder. GitHub zamanlamayı geciktirebilir; 15 dakika kesin süre değildir. Manuel hızlandırma için GitHub Actions > Publish verified Astro output > Run workflow kullanılabilir. Zamanlanmış işlerin uzun repo hareketsizliğinde durması da GitHub'ın sınırları arasındadır.
7. Paneldeki 'sitede derlenen sürüm' bilgisi, gerçekten yayımlanan manifestten okunur. Yayın akışı ile statik sitenin hazır olması ayrı durumlardır.

Kaydedilmemiş değişiklik varken yayımlama kapalıdır. Başka sekme aynı yazıyı değiştirirse revision kontrolü eski kaydın yenisini ezmesini reddeder; metni kopyalayıp son sürümle karşılaştırmak gerekir. Adres ilk kayıttan sonra panelde sabittir. İleri tarihli otomatik yayın ve sürüm geçmişinden tek düğmeyle geri dönüş bu sürüme dahil değildir. Değişiklik geçmişi özel DB'de tutulur.

## Veri / güvenlik

`cx_private.content_roles`, `drafts`, `publications`, `content_history` API'ye kapalıdır; RLS ret politikaları ve sıfır istemci tablo yetkileri vardır. İki yetkili invoker RPC (`cx_editor_read/write`) kontrol edilen özel geçitlere gider. Kimlik `auth.uid()` ve rol veritabanından alınır. Normal üyeler, yorum moderatörleri ve anonim ziyaretçiler taslak okuyamaz. Kullanıcı metadata'sı yetki vermez. Yeni kayıtta ve her yazmada doğrulanmış üyelik/engel tekrar kontrol edilir.

Anonim `cx_content_feed` yalnızca açıkça yayımlanmış kopyaları döndürür. Yayından kaldırılmış kayıtlar slug/sürüm/active=false olarak döner; gövde ve taslak değişiklikleri gönderilmez. Bir içerik yayımlandıktan sonra Git geçmişinden ve ziyaretçi önbelleklerinden geriye dönük silinmiş sayılmaz.

Yayımla/yayından kaldır işlemi etkileşim yazı kaydını aynı transaction'da günceller. `db/posts.sql` eski başlangıç kaydıdır; artık paneldeki yayın işlemiyle aynı bilgiyi elle iki yerde güncellemek gerekmez.

## Statik yayın

`prepare-content.mjs` yalnızca public publishable key kullanır. Kaynak başlangıç yazılarını yayın snapshot'larıyla birleştirip `.cache/blog` içine yazar; inactive kayıtlar kaynak fallback'ini de bastırır. `.cache` Git'e girmez. Feed alınamazsa build durur; mevcut siteye dokunulmaz. Site/Pagefind/RSS/sitemap aynı hazırlanmış koleksiyondan üretilir.

Zamanlanmış iş, manifest hash değişmediyse Astro derlemesini atlar. Gerçek yayında önce eski üretilmiş sayfa dizinleri temizlenir; böylece yayından kaldırılan sayfa ve eski arama dizini kökte kalmaz. `public/content-manifest.json` ve kökteki kopya yalnızca açık yayın sürümlerini taşır. Gizli anahtar, GitHub token veya DB şifresi istemciye verilmez.

`db/editor.sql` şemayı, `db/editor-tests.sql` rollback içinde sentetik kullanıcılarla erişim/sürüm/yayın testlerini tanımlar. Yedekleme adımı kullanıcının isteğiyle kapsamdan çıkarılmıştır; bu panel bir yedekleme sistemi kurmaz.

## Görseller

Kapak ve yazı içi görsel yükleme eklendi. JPEG/PNG/WebP/AVIF kaynak en fazla 15 MB; tarayıcı uzun kenarı en fazla 1920 piksele indirir, meta verilerini taşımadan WebP üretir ve 2 MB çıktı sınırı uygular. SVG/GIF kabul edilmez. Yüklenen görsel tekrar seçilip kapakta veya birden fazla yazıda kullanılabilir; açıklama metni kapağın alt alanına veya Markdown alt metnine yazılır. Önizleme 60 saniyelik imzalı özel adres kullanır; bu adres metne kaydedilmez.

`cx-editor-media` özel Storage bucket'ıdır. Sadece doğrulanmış ve engellenmemiş içerik yetkilileri yükleyebilir/seçebilir. Normal üyeler ve yalnızca yorum moderatörü olan hesaplar erişemez. Dosya yolu kullanıcı UUID'si ve rastgele dosya UUID'sidir; üzerine yazma yoktur. Kaydı oluşmuş dosyalar istemciden silinemez. Başarısız kayıt sonrasında yalnızca kendi kayıtsız yüklemesini temizleme hakkı vardır.

Özel `media` kayıtları yayınlara `publication_media` üzerinden bağlanır. Yayın snapshot'ının kapak/gövdesindeki yönetilen görsel adresleri aynı transaction'da doğrulanır. Etkin yayında kullanılan dosyalar RLS ile anonim derleme istemcisine okunabilir hale gelir; diğer dosyalar ve taslaklar özel kalır. Yayından kaldırılınca başka etkin yazıda kullanılmayan dosyanın anonim erişimi kapanır; mevcut statik kopya sonraki başarılı site yayınına kadar kalabilir. Daha önce herkese yayımlanmış dosya Git geçmişinden/ziyaretçi önbelleğinden geriye dönük geri alınmış sayılmaz.

Derleme public feed'deki etkin dosyaları indirir; boyut ve WebP imzasını doğrular ve `public/assets/img/uploads/` içine koyar. Bu dizin otomatik yönetilir; elle dosya koyma. Artık kullanılmayan dosyalar yeni çıktıya taşınmaz. İmzalı adres, özel taslak veya ayrıcalıklı anahtar derlemeye girmez. Mevcut yayımlanmış dosyalar boyut kontrolüyle yeniden kullanılır.

`db/media.sql` ve `db/media-tests.sql` yetkileri ve rollback testlerini tanımlar. SQL testi yalnızca metadata fixture'ı kullanır, fiziksel dosya oluşturmaz; dosya kodlama/yükleme/önizleme tarayıcı testinde gerçek canvas çıktısı ve taklit Storage yanıtlarıyla sınanır. Gerçek kullanıcı oturumuyla ilk dosya yükleme ayrıca kullanıcı tarafından denenmelidir.
