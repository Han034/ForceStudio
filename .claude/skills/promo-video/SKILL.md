---
name: promo-video
description: Uygulamalar için yüksek animasyonlu tanıtım / lansman videoları (claude.ai "Motion" filmi olarak, düzenlenebilir). Dikey 9:16 öncelikli, isteğe göre yatay 16:9 ve müziğe göre ritim kurgusu. Kullanıcı "tanıtım videosu", "lansman videosu", "reels/tiktok videosu", "promo", "ritim kurgusu" dediğinde kullan.
---

# Promo Video (Motion filmi)

## 0. Varsayılanlar (sorulmadan geçerli)
- **Biçim:** claude.ai **Motion** artifact türü (düzenlenebilir film; Export ile MP4). Ham MP4/HTML render yapma.
- **Format:** Dikey **1080×1920** birincil. Yatay 1920×1080 sadece istenirse; her en-boy oranı **ayrı film** (asla yeniden boyutlandırma).
- **Süre:** 15 sn.
- **Stil:** "Ekran içinden" — kamera uygulama ekranına dalar; dokunuşlar, kartlar ve listeler canlanır.
- **Renkler:** Her uygulamanın **kendi** marka renkleri (repo kodundan: CSS değişkenleri, tema, tailwind, logo).
- **Dil:** Uygulamanın kendi dili (genelde Türkçe). Metinler uygulamanın gerçek metinlerinden.
- Motion türünün 3 sorusu (Stil · Renk · Süre) bu varsayılanlarla **cevaplanmış sayılır**; tekrar sorma.

## 1. İş akışı
1. Her uygulama için **ayrı bir alt ajan** başlat (paralel). Ajan:
   - Repoyu okur (README, docs, src, icons/, public/, store-assets/, resources/). `npm install` / çalıştırma yok.
   - Motion filmini oluşturur: `type_url` = Motion türü, başlık `"<Uygulama> Lansman Videosu (Dikey)"`.
   - Türün referanslarını okur: rough-cut.md → finalize.md, motion.md, film-api.md, recreate-ui.md.
   - İlk batch (film/meta → scenes.json `stage:"rough"` → base.css → film/script), sonra sahne başına bir `set`, sonunda müzik + `stage:"final"`.
   - Görselleri (logo, ekran görüntüsü) WebP'ye çevirip **o filme** yükler; başka filmin `/_blob/` id'sini asla kullanmaz.
   - Repoya dokunmaz, commit/push yapmaz; video/ses dosyası üretmez.
2. Revizyonlarda yeni ajan açma; aynı ajana **SendMessage** ile devam et (film ve kodu zaten bağlamında).
3. Aynı uygulamanın varyantları (dikey/yatay/ritim) = **ayrı filmler**.

## 2. Hareket ve kurgu kuralları (en önemli bölüm)
### Tekrar yasağı
- "Üstte başlık + altta telefon + yakınlaş" düzeni filmde **en fazla 1 kez**.
- Art arda iki sahne aynı yerleşimi veya aynı kamera hareketini **kullanamaz**.
- 6–8 kısa sahne (≈1.2–2.5 sn); uzun statik tutuş yok.

### Her sahne farklı bir teknik
Bu listeden (ve ötesinden) her sahneye farklı biri:
- Çerçevesiz, tam ekran arayüz (telefon çerçevesi yok)
- Arayüz öğelerinin ekrandan **dışarı fırlayıp** 3D derinlikte uçması
- **Butona/sayıya/karta dönüşen** kinetik yazı
- Bölünmüş ekran (ör. müşteri ↔ usta, sen ↔ rakip) veya ızgara
- 3D karusel
- 3D dönen cihaz + önde/arkada paralaks katmanlar
- Dokunma noktasından açılan **dairesel maske**
- Hareket bulanıklıklı **hızlı kayma (whip pan)**
- Tek bir detaya **makro yakın çekim** (sayaç, yüzde, toggle)
- Sabit yazı bandı yerine sahnenin/arayüzün **içine yerleşmiş** yazı

### Geçişler
- **Düz kesme yok.** Her sahne bir sonrakine bağlanır:
  - **Eşleşme kesmesi:** N. sahnedeki öğe N+1'in sahnesi olur (kart büyüyüp sonraki ekran olur, rozet logoya dönüşür).
  - Dairesel/çapraz maske, morph, zoom-through (bir öğenin içinden geçiş), whip/push.
- Bir sahnenin son karesi bir sonrakinin ilk karesiyle görsel olarak eşleşmeli.

### Sürekli hareket
- Hiçbir kare durağan kalmaz: süzülen parçacıklar, nefes alan parıltı, hafif sürekli kamera kayması.
- Listelerde kademeli giriş (stagger), yaylanan aşma (overshoot), squash/stretch.
- Parçacıklar film saatine bağlı olsun ki sahne geçişlerinde zıplamasın.

### Kapanış
- Logo + slogan + CTA ("Şimdi indir" / "Hemen oyna" / "Ücretsiz başla"), en az ~2.5–3 sn tutulur.

## 3. Ritim kurgusu (müziğe göre)
Kullanıcı bir şarkı verirse:
- **Film sessizdir** (müzik modülü yok). Motion türü telifli şarkı/ses dosyası kabul etmez; kullanıcı şarkıyı Reels/TikTok/CapCut'ta ekler.
- Şarkının **adı, sanatçısı, sözleri ekranda asla** yer almaz.
- Kullanıcıdan **BPM** ve **bölüm** (genelde nakarat) al.
- Vuruş ızgarası tek yardımcıda: `BEAT = 60/BPM`, `BAR = 4*BEAT`. Tüm sahne içi zamanlar bundan türetilir.
  - Örn. 99 BPM → vuruş 0.6061 sn, ölçü 2.4242 sn.
- Yapı:
  - **Ölçü 1 (0 → 1 ölçü):** giriş; yavaş yaklaşma, büyüyen parıltı, son yarım vuruşta "nefes tutma". Hiçbir şey vurmaz.
  - **Nakarat (1. ölçü sonu):** filmin en büyük görsel vurgusu tam bu karede (şok halkası, maske açılışı, zoom-through).
  - **Nakarat boyunca:** sahne değişimleri **sadece vuruşlarda** (tercihen ölçü başı, birkaç 2 vuruşluk kesme). Nakarattan sonra **her vuruşta** hafif vurgu (ölçek nabzı, parıltı, kamera itişi); her ölçünün 2. ve 4. vuruşu daha güçlü.
  - **Kapanış vurgusu:** 5. ölçü sonu (99 BPM'de 12.12 sn), sona kadar vuruş başına hafif nabız.
- Kullanıcıya hizalama talimatı ver: "Nakaratın ilk vuruşunu videonun X. saniyesine hizala".
- Not: `scenes.json`'daki sahne süreleri sabit sayıdır; BPM değişirse onlar da güncellenmeli.
- Atmosfer şarkıya göre (ör. indie-synth → neon parıltı, ışık izleri, ileri yolculuk eden kamera), marka renkleri temel kalır.

## 4. Güvenli alan (dikey, Reels/TikTok)
- Yazı ve butonlar: **üstten 250 px, alttan 420 px, sağdan 120 px** dışında kalır.
- Bu bölgelere sadece süs hareketleri (parıltı, parçacık, cihaz gövdesi) girebilir.

## 5. İçerik ve güvenlik kuralları
- Gerçek ekranları uygulamanın kendi CSS'i, ikonları ve metinleriyle yeniden kur; lorem ipsum veya yer tutucu kutu yok.
- **Üçüncü taraf logosu yok:** mağaza rozetleri, işletim sistemi, banka, harita sağlayıcısı, oyun/marka logoları yok. Genel bir CTA butonu kullan. Gerçek oyun/marka adları en fazla düz yazı olarak geçer.
- Uydurma tutar/isim/puan varsa açıkça örnek veri olmalı (ör. "Örnek veriler" etiketi).
- Saniyede 3'ten fazla yanıp sönme yok; vuruş vurguları yanıp sönme değil nabızdır.
- Haritalar soyut çizim; harita sağlayıcısı karoları yok.

## 6. Bilinen tuzaklar
- Ajanlar filmi **oynatamaz**; konumlar hesapla ayarlanır. Teslimde kullanıcıya "bir kez baştan sona oynat" de.
- **3D CSS** (perspective, rotateY) Export'ta düzleşebilir. Riskliyse 2D ile taklit et; kullanıcıya bir Export'u kontrol etmesini söyle.
- Hızlı geçişlerdeki CSS blur ve `clip-path` Export'ta farklı görünebilir.
- Oturum başına en fazla **10 film izlenebilir** (yorum bildirimi); fazlası için kullanıcı değişiklikleri sohbete yazmalı.
- Font ağırlığı: yüklenen ağırlıkları kontrol et (ör. 800 isteyip 700 yükleme).
- Çok kısa sahnelerde yazılar 0.6–0.8 sn'de okunmayabilir; önemli satırları ≥1 sn tut.
- Paylaşım: filmler özeldir; başkası görecekse kullanıcı Share menüsünden paylaşmalı.

## 7. Teslim raporu (ajandan istenecek)
Film linki · sahne listesi (sn ve ritim filmlerinde vuruş) · her sahnenin tekniği ve çıkış geçişi · yüklenen görseller · yapılamayanlar ve kontrol edilmesi gereken yerler.
