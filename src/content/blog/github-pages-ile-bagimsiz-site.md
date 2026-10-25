---
title: "GitHub Pages ile bağımsız web sitesi kurmak mümkün mü?"
description: "GitHub Pages'in statik web sitelerine neler sunduğunu, hangi durumlarda yeterli olduğunu ve üyelik gibi özellikler için neden ek hizmetler gerektiğini inceliyoruz."
pubDate: 2026-10-25
category: "Dijital Dünya"
tags: ["GitHub Pages", "Web Geliştirme", "Barındırma"]
cover: "assets/img/corexlyth-lab.svg"
coverAlt: "Dijital geliştirme laboratuvarı temalı illüstrasyon"
---

Bir web sitesini yayınlamak için mutlaka klasik bir hosting paketi satın almak gerekmez. **GitHub Pages**, HTML, CSS, JavaScript ve statik dosyaları GitHub depolarından yayınlamak için kullanılan bir hizmettir.

CoreXLyth'in yeni döneminde de ilk yayın katmanı olarak GitHub Pages kullanılıyor.

## Statik site ne demek?

Statik bir sitede sayfalar, ziyaretçi isteğinde her seferinde sunucuda yeniden üretilmek yerine önceden hazırlanmış HTML dosyaları şeklinde sunulabilir.

Bu model özellikle bloglar, portföyler, belgeler ve tanıtım siteleri için güçlü bir başlangıçtır. İyi tasarlandığında hızlı, önbelleğe uygun ve bakımı kolaydır.

## Peki blog yazılarını nasıl yöneteceğiz?

Tek bir HTML dosyasına yüzlerce yazı eklemek sürdürülebilir değildir. Bu yüzden CoreXLyth'te **Astro** kullanıyoruz.

Yazılar Markdown dosyalarında saklanıyor. Astro yayın sırasında bu içeriklerden yazı sayfaları, kategori bağlantıları ve arşiv üretiyor. Sonuçta GitHub Pages yine statik HTML sunuyor.

## GitHub Pages'in yapamadıkları

GitHub Pages tek başına bir kullanıcı veritabanı veya güvenli sunucu API'si değildir. Örneğin aşağıdaki işler için ek bir arka uç sistemi gerekir:

- Üyelik ve oturum yönetimi
- Kullanıcıya özel kaydedilen yazılar
- Yorum, beğeni ve bildirim verileri
- Yöneticiye özel gizli işlemler

Bu özellikleri ileride Supabase gibi bir kimlik doğrulama ve veritabanı sistemiyle; gerektiğinde güvenli sunucu fonksiyonlarıyla birleştirebiliriz.

**Önemli:** Tarayıcıya gönderilen JavaScript kodunda gizli API anahtarları tutulmaz. Kullanıcı yetkileri sunucu/veritabanı tarafında doğrulanmalıdır.

GitHub Pages ve Astro birleşimi, bağımsız bir içerik portalı kurmak için düşük maliyetli ve kontrollü bir başlangıç sağlar.
