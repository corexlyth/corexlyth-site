---
title: "LocalSend ile telefon ve bilgisayar arasında dosya gönderme"
description: "LocalSend nasıl çalışır? Android ile Windows, macOS veya Linux arasında aynı ağ üzerinden dosya aktarmak için temel kurulum ve sorun giderme rehberi."
pubDate: 2026-10-25
category: "Uygulamalar"
tags: ["Android", "LocalSend", "Açık Kaynak"]
cover: "assets/img/corexlyth-apps.svg"
coverAlt: "Uygulama pencereleri ve telefon sembollerinden oluşan dijital illüstrasyon"
---

Telefondan bilgisayara birkaç fotoğraf göndermek için kendine mesaj atmak veya buluta yükleme yapmak zorunda değilsin. **LocalSend**, aynı yerel ağdaki cihazlar arasında dosya aktarımı yapabilen ücretsiz ve açık kaynaklı bir uygulama.

Android, iOS, Windows, macOS ve Linux üzerinde çalışır. Hesap açma zorunluluğu yoktur. Aktarım yerel ağ üzerinden yapılabildiği için çalışırken bir bulut sunucusuna dosya yüklemek gerekmez.

## Kurulum

1. Uygulamayı telefonuna ve dosya göndereceğin bilgisayara kur.
2. İki cihazı birbiriyle iletişim kurabilen aynı yerel ağa bağla.
3. LocalSend'i her iki cihazda da aç.
4. Gönderen cihazda dosyayı seç, görünen alıcı cihaza dokun.
5. Alıcı cihazdan aktarımı onayla.

İlk denemede küçük bir fotoğraf göndererek iki yönlü bağlantıyı test edebilirsin.

## Cihazlar birbirini görmüyorsa

Bazen iki cihaz aynı Wi-Fi adına bağlı görünse bile birbirine erişemez. Önce şu noktaları kontrol et:

- Telefon ve bilgisayarın aynı yerel ağda olduğundan emin ol.
- Misafir ağlarında etkin olabilen **istemci/AP izolasyonu** bağlantıyı engelleyebilir.
- Bilgisayarın güvenlik duvarı yerel ağ trafiğini durduruyor olabilir.
- VPN kullanıyorsan kısa bir test için bağlantının ağ yönlendirmesini etkileyip etkilemediğini kontrol et.

LocalSend'in resmi belgelerinde gerekirse gelen **TCP ve UDP 53317** trafiğine izin verilmesi anlatılır. Güvenlik duvarında kural açmadan önce bunun yalnızca güvendiğin yerel ağla sınırlı olduğundan emin ol.

## Güvenlik açısından bilmen gerekenler

LocalSend, yerel bağlantıda HTTPS kullanır. Yine de dosya göndermeden önce hedef cihazı doğrulamak ve beklenmedik gelen aktarım isteklerini reddetmek iyi bir alışkanlıktır.

**Resmi proje:** [LocalSend GitHub deposu](https://github.com/localsend/localsend)

CoreXLyth'te bir sonraki adımda ekran görüntüleriyle daha ayrıntılı kurulum senaryolarını ayrıca ele alabiliriz.
