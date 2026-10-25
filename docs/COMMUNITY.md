# Topluluk v1

Yazılarda yorum/tek düzey yanıt, beğeni, özel kaydetme; hesapta isteğe bağlı görünen ad ve son 100 kaydedilen yazı; `/hesap/moderasyon/` altında onay/silme/üye engelleme bulunur. Kapalı test etiketi ve genel üyelik menüsü korunur.

## Veri ve yetki

- `cx_private` API'ye açılmayan şemadır. Tablolarda RLS ve açık ret politikası vardır; istemcinin tablo ve sequence yetkisi yoktur.
- API yalnızca iki SECURITY INVOKER sarmalayıcı sunar: `cx_community_read` ve `cx_community_write`. Ayrı şemadaki SECURITY DEFINER geçitleri sabit boş search_path, açık kullanıcı/rol kontrolleri ve sınırlı işlemler kullanır. İç yardımcıların EXECUTE yetkileri istemciden alınmıştır.
- Kullanıcı kimliği istemciden parametre alınmaz, `auth.uid()` ile belirlenir. Yazma sırasında doğrulanmış, anonim olmayan üyelik ve veritabanındaki engel durumu tekrar kontrol edilir. Rol user_metadata'dan okunmaz.
- Bekleyen ve eski sürümden kalan gizli yorumları yalnızca sahibi ve moderatör görür. Herkese açık yorum verisinde e-posta veya kullanıcı UUID'si yoktur. Beğeniler yalnızca toplam olarak döner. Kaydedilenler yalnızca sahibine döner.
- Tüm metinler `textContent` ile çizilir; HTML/Markdown yorum içinde çalıştırılmaz. Görünen ad herkese açıktır; kullanıcıya bu açıklanır.
- Yorum: 1–2000 karakter, 30 saniye aralık ve saatte 10 gönderim. Profil: boş bırakılabilir; doluysa 2–40 karakter. Adı olmayan doğrulanmış üyeler Anonim adıyla yorum gönderebilir. Etkileşimler: saniyede 1, saatte 120. Atomik satır kilidi eşzamanlı sınır aşımını engeller. Yeni yorumlar otomatik yayımlanmaz. Turnstile henüz eklenmedi; genel açılıştan önce ayrı spam değerlendirmesi gerekir.
- Yazı+hesap benzersiz anahtarı ikinci beğeniyi engeller. Yanıt yalnızca aynı yazının yayımlanmış kök yorumuna verilir. Yorum sahibi ve yönetici yorum silebilir; silme metni mezar taşıyla değiştirir; kaydın kimliği yanıtların bozulmaması için korunur. Moderasyon olayları özel denetim tablosuna kaydolur.
- Görünen ad değişimi mevcut yorumlarda da görünür. Moderatör rolü veya kendi engel durumunu değiştiren istemci işlemi yoktur. Başka moderatörler panelden engellenemez.

## Kurulum / yayın

Şema `db/community.sql`; Supabase uzakta `community_foundations`, `community_explicit_client_denial` ve `community_independent_reaction_limits` migration'larıyla kuruldu. İçerik ana kaynağı Markdown kalır. `db/posts.sql` yayımlanmış beş yazının slug/başlık kaydıdır. Yeni yazı eklerken bu kayıt güvenilen DB yayın adımıyla güncellenmelidir; taslak/silinen yazı için `active=false` yapılır. İstemci bilinmeyen yazı oluşturamaz. Site derlemesine asla service-role/DB şifresi konmaz.

İlk moderatör, sahibin ekran görüntüsünde doğrulanmış olarak gösterdiği mevcut test hesabına proje yönetiminden atanmıştır. Otomatik ilk üye/moderatör ataması yoktur; kayıt olan yeni hesaplar normal üyedir. Sonraki moderatör atamaları yalnızca güvenilen DB yönetiminden, doğrulanmış hedef kimlik için yapılır. Kimlik ve e-posta bu depoya yazılmaz.

Örnek yönetim sorgusu (gerçek kimlik yönetim oturumunda doğrulanmalıdır):

```sql
insert into cx_private.members(user_id,moderator)
values ('VERIFIED_USER_UUID',true)
on conflict(user_id) do update set moderator=true;
```

`db/community-tests.sql` gerçek verileri değiştirmeden, transaction/rollback içinde sentetik kullanıcılarla erişim kontrollerini sınar. E-posta göndermez. Bekleyen görünürlüğü, anonim erişim, başka üyeyi silme, özel bookmark, yinelenen beğeni, moderasyon, engel, spam sınırı, yanıt kapsamı, doğrulanmamış üye ve silmeyi kapsar.

Güvenlik danışmanı mevcut projede sızmış şifre korumasının kapalı olduğunu bildirdi; bu topluluk değişikliği mevcut şifre ayarını değiştirmedi. Genel üyelik açılışı için özel SMTP ve gerçek teslimat kontrolleri ayrıca bekliyor.

## Sade yorum arayüzü

Takma ad düzenleme yalnızca Hesabım bölümündedir; boş kaydetme takma adı kaldırır. Yazılarda yöneticiler dahil herkes aynı sade yorum arayüzünü kullanır: Yayınla gönderimi, uygun kök yoruma Yanıtla ve kendi yorumuna Sil. Yayınla gönderimi yönetici onayını atlamaz. Yönetim düğmeleri yalnızca moderasyon sayfasında, panel bağlantısı yalnızca yetkili hesabın Hesabım bölümünde görünür. Sunucu normal üyeye onaylama/yönetici silme hakkı tanımaz.

Gizle işlemi API ve arayüzden kaldırıldı; eski gizli kayıtlar kendiliğinden yayımlanmaz, panelden onaylanabilir veya silinebilir. Silinen yorumun metni arayüzde bir kez gösterilir. `community_optional_alias_and_admin_deletion` güncellemesi ve `db/community-refinement.sql` bu davranışı mevcut projeye uygular.
