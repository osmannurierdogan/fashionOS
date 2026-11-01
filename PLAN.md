# fashionOS — Proje Planı

Kişisel gardırobu dijitalleştiren ve gardıroptaki parçalardan kombin öneren web uygulaması.
İlk kullanıcı tek kişi, ama yapı baştan **çok kullanıcılı ve satılabilir (SaaS)** kuruluyor.

---

## 1. Kararlar (özet)

| Konu | Karar |
|---|---|
| Kullanıcı modeli | Çok kullanıcılı (multi-tenant), ileride abonelik planları |
| Önyüz | React + Vite + TypeScript + Tailwind, **PWA** (telefona kurulabilir) → **Netlify** |
| Arka yüz | Node.js + TypeScript + Fastify (REST API) → **Railway** |
| Veritabanı | **MongoDB Atlas** (Mongoose ile) |
| Fotoğraf depolama | **AWS S3** (özel bucket, imzalı URL ile erişim) — geliştirmede yerel disk |
| Arka plan silme | Tarayıcıda, `@imgly/background-removal` (ücretsiz, sunucuya yük yok) |
| Yapay zekâ | **Qwen** (açık kaynak, görsel destekli; OpenAI uyumlu sağlayıcı: OpenRouter / DashScope / Ollama) |
| Hava durumu | Open-Meteo (ücretsiz, anahtarsız) |
| Arayüz | Türkçe, önce mobil tasarım |

---

## 2. Mimari

```
 Telefon / Tarayıcı (PWA)
        │
        ▼
 Netlify  ── statik React uygulaması
        │   /api/*  isteklerini Railway'e proxy'ler (aynı origin → güvenli cookie)
        ▼
 Railway  ── Fastify API
        ├── MongoDB Atlas      (kullanıcılar, parçalar, kombinler, geri bildirim)
        ├── AWS S3             (parça fotoğrafları)
        ├── Qwen (OpenAI uyumlu) (etiketleme, stilist)
        └── Open-Meteo         (hava durumu)
```

**Neden Netlify proxy?** Önyüz ve API farklı alan adlarında olunca oturum cookie'leri
"üçüncü taraf cookie" sayılıp tarayıcılarda (özellikle iOS Safari) engelleniyor.
Netlify `/api/*` yolunu Railway'e yönlendirince her şey tek alan adından çalışır.

**Depo yapısı (monorepo, npm workspaces):**
```
fashionOS/
├── apps/web        → React PWA (Netlify)
├── apps/api        → Fastify API (Railway)
└── packages/shared → ortak tipler, kategori/renk sözlüğü, doğrulama şemaları (zod)
```
Aynı doğrulama kuralları hem formda hem API'de kullanılır.

---

## 3. Çok kullanıcılı (SaaS) yapı

- Her kayıt (parça, kombin, geri bildirim) `userId` taşır; **tüm sorgular API katmanında
  zorunlu olarak kullanıcıya göre filtrelenir** (tek bir yardımcı üzerinden, unutulamaz).
- Fotoğraflar depoda `users/{userId}/...` altında; erişim kısa ömürlü imzalı URL ile.
- **Kimlik doğrulama:** e-posta + şifre (bcrypt), oturum token'ı httpOnly cookie'de,
  oturumlar veritabanında (çıkış / tüm cihazlardan çıkış yapılabilir).
  Sonra: Google ile giriş, e-posta doğrulama, şifre sıfırlama.
- **Plan ve kota:** kullanıcıda `plan: free | pro` ve aylık kullanım sayaçları
  (yapay zekâ etiketleme sayısı, kombin üretimi sayısı, parça sayısı). Ödeme sistemi
  (Stripe / iyzico) ileride eklenir, altyapı baştan hazır olur.
- **Güvenlik:** rate limit (özellikle giriş ve yapay zekâ uçları), dosya tipi/boyut kontrolü,
  KVKK için "hesabımı ve verilerimi sil" ve "verilerimi indir".

---

## 4. Veri modeli (MongoDB koleksiyonları)

### `users`
- email, passwordHash, name
- plan, usage `{ aiTags, aiOutfits, periodStart }`
- profile:
  - gender / kesim tercihi (opsiyonel)
  - stiller (spor, smart casual, klasik, sokak, minimal, bohem…)
  - sevdiği renkler, kaçındığı renkler
  - giymediği kalıplar / notlar ("dar paça sevmem" vb.)
  - şehir + koordinat (hava durumu için)

### `items` (parçalar)
| Alan | Açıklama |
|---|---|
| userId | sahibi |
| images | `original`, `cutout` (arka plansız PNG/WebP), `thumb` |
| category / subcategory | Üst (tişört, gömlek, kazak…), Alt, Elbise/Tulum, Dış giyim, Ayakkabı, Aksesuar (çanta, kemer, saat, takı, şapka, atkı, gözlük…) |
| colors | `[{ name, hex, ratio }]` — ana + ikincil |
| pattern | düz, çizgili, ekose, puantiyeli, çiçekli, baskılı, kamuflaj… |
| material | pamuk, keten, yün, denim, deri, ipek, polyester, triko… |
| seasons | ilkbahar / yaz / sonbahar / kış |
| warmth | 1–5 (ne kadar sıcak tutar) |
| formality | 1–5 (spor → çok resmi) |
| styles | stil etiketleri |
| layer | iç / orta / dış katman (katmanlı kombin için) |
| brand, size, price, purchasedAt, notes | ek bilgi |
| favorite, archived | |
| wearCount, lastWornAt | giyilme istatistikleri |
| aiTagged | etiketler yapay zekâdan mı geldi |

### `outfits` (kombinler)
- userId, itemIds[], kaynak (`ai` / `manual`), bağlam `{ occasion, weather, note }`
- AI açıklaması, kullanıcı puanı (beğen/beğenme), kaydedildi mi, kolaj görseli

### `wearLogs` (giyim geçmişi)
- userId, outfitId veya itemIds[], tarih → `wearCount` / `lastWornAt` buradan güncellenir

### `sessions`
- userId, tokenHash, userAgent, expiresAt (TTL index ile otomatik silinir)

---

## 5. Parça ekleme akışı

1. Kameradan çek veya galeriden seç (birden fazla seçilebilir — toplu yükleme).
2. **Tarayıcıda arka plan silinir** → önizleme ("beğenmedim, orijinali kullan" seçeneği).
3. Tarayıcıda baskın renkler çıkarılır → renk alanı otomatik dolar (yapay zekâsız da çalışır).
4. **Qwen etiketleme** (API anahtarı varsa): kategori, alt kategori, desen, kumaş,
   mevsim, sıcaklık, resmiyet, stil önerir.
5. Kullanıcı formu kontrol eder → kaydet. Sunucu görseli küçültür (WebP) + küçük önizleme üretir.

---

## 6. Kombin motoru (hibrit)

**Girdiler:** etkinlik/amaç ("iş toplantısı", "akşam yemeği", serbest metin), hava durumu
(otomatik), ruh hâli, istenirse "şu parça mutlaka olsun".

**Adım 1 — Kurallarla aday üretimi (sunucuda, hızlı, ücretsiz)**
- Yapı: (üst + alt) veya (elbise/tulum) + ayakkabı; sıcaklığa göre dış giyim / katman.
- Filtre: mevsim, sıcaklık (warmth ↔ hissedilen sıcaklık), yağmurda süet/açık ayakkabı yok.
- Resmiyet: parçalar arası fark en fazla 1–2 seviye, hedef resmiyete yakın.

**Adım 2 — Puanlama**
- Renk uyumu: nötrler (siyah, beyaz, gri, lacivert, bej, denim) her şeyle; tamamlayıcı / analog /
  ton-sür-ton bonus; aynı kombinde en fazla 1 baskın desen.
- Kullanıcı profili: sevdiği renk/stil bonus, kaçındığı ceza.
- Tazelik: son günlerde giyilen parçalara ceza, uzun süredir giyilmeyenlere hafif bonus.
- Öğrenme: beğenilen kombinlerdeki parça ikilileri bonus, beğenilmeyenler ceza.

**Adım 3 — Qwen stilist**
- En iyi ~12 farklı aday + parça özellikleri + bağlam Qwen'e gönderilir.
- Model 3 kombin seçer, aksesuar ekler, her biri için kısa Türkçe açıklama yazar.
- **Yalnızca gönderilen parça ID'lerini kullanabilir** (yapılandırılmış çıktı) → gardıropta olmayan
  bir şey öneremez. API anahtarı yoksa veya kota dolduysa sadece kural motoru sonuçları gösterilir.

**Adım 4 — Gösterim**
- Arka plansız parçalar flat-lay kolaj olarak dizilir (üst-alt-ayakkabı-aksesuar düzeni).
- Butonlar: 👍 / 👎 / "Bunu giydim" / "Bu parçayı değiştir" / Kaydet.

---

## 7. Ekranlar (mobil öncelikli, alt menü)

1. **Bugün** — hava durumu + günün 3 kombin önerisi, "başka öner".
2. **Gardırop** — kategori sekmeleri, filtre (renk, mevsim, stil, favori), arama, ızgara görünüm.
3. **+ Ekle** — kamera/galeri, toplu yükleme, etiket formu.
4. **Kombin oluştur** — amaç/etkinlik gir, belirli bir parçadan başlat ("bu ceketle ne giyerim?").
5. **Kombinlerim** — kaydedilenler, geçmiş, takvim görünümü.
6. **Profil** — stil tercihleri, şehir, plan/kota, hesap ayarları, veri indir/sil.
7. Parça detay — fotoğraf, bilgiler, giyilme istatistiği, "bu parçayla kombinler".

---

## 8. API uçları (taslak)

```
POST   /api/auth/register | /login | /logout        GET /api/auth/me
GET    /api/profile                                  PATCH /api/profile
GET    /api/items?category=&color=&season=&q=        POST  /api/items   (multipart)
GET    /api/items/:id    PATCH /api/items/:id        DELETE /api/items/:id
POST   /api/ai/tag            (fotoğraf → önerilen etiketler)
POST   /api/outfits/suggest   (bağlam → kombin önerileri)
GET    /api/outfits   POST /api/outfits   PATCH /api/outfits/:id (puan, kaydet)
POST   /api/wear              (giydim kaydı)
GET    /api/weather?lat=&lon=
GET    /api/stats             (az giyilenler, renk dağılımı…)
GET    /api/account/export    DELETE /api/account
```

---

## 9. Yayın (deploy)

| Parça | Nerede | Not |
|---|---|---|
| Web | Netlify | `apps/web` build, `netlify.toml` içinde `/api/*` → Railway proxy |
| API | Railway | `apps/api`, ortam değişkenleri: `MONGODB_URI`, `SESSION_SECRET`, `AI_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` |
| DB | MongoDB Atlas | Ücretsiz M0 küme başlangıç için yeterli |
| Fotoğraf | AWS S3 | Özel (public olmayan) bucket; görseller kısa ömürlü imzalı URL ile açılır |

Ortamlar: yerel geliştirme (Vite proxy + yerel Mongo/Atlas), ileride staging.

**Tahmini maliyet (tek kullanıcı):** Netlify, Atlas M0 ücretsiz; S3 birkaç yüz parça için ayda birkaç sent; Railway ≈ 5 $/ay;
Qwen: Ollama ile ücretsiz, OpenRouter/DashScope ile istek başına çok düşük maliyet.

---

## 10. Aşamalar

| # | Aşama | Çıktı |
|---|---|---|
| 0 | **Kurulum** | Monorepo, ortak sözlük/şemalar, API iskeleti, Mongo bağlantısı, kayıt/giriş, PWA kabuğu, Netlify + Railway ilk deploy |
| 1 | **Gardırop** | Fotoğraf yükleme, tarayıcıda arka plan silme, renk çıkarma, parça formu, ızgara + filtre, düzenle/sil |
| 2 | **Yapay zekâ etiketleme** | Qwen ile otomatik etiket, toplu yükleme, kota sayacı |
| 3 | **Kombin önerisi** | Kural motoru + puanlama, Qwen stilist, hava durumu, "Bugün" ekranı, kolaj |
| 4 | **Geri bildirim & geçmiş** | Beğen/beğenme, "giydim", kombin kaydetme, tekrar önleme, öğrenme |
| 5 | **Ekstralar** | Haftalık plan/takvim, valiz listesi, istatistikler, eksik parça önerisi |
| 6 | **Satışa hazırlık** | Ödeme (Stripe/iyzico), planlar, e-posta doğrulama, şifre sıfırlama, landing sayfası, KVKK metinleri |

**İlk kullanılabilir sürüm (MVP): 0–3.**
Her aşama sonunda çalışan, deploy edilmiş bir sürüm olur.

---

### S3 kurulumu
- Bucket: tamamen özel ("Block all public access" açık), bölge örn. `eu-central-1` (Frankfurt).
- Anahtar yapısı: `users/{userId}/items/{itemId}/{original|cutout|thumb}.webp`.
- IAM politikası yalnızca bu bucket'ta `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` izni verir.
- Görseller tarayıcıya kısa ömürlü (ör. 1 saat) imzalı GET URL'leriyle sunulur; kullanıcı silinince klasörü de silinir.
- İleride: CloudFront önbelleği, eski görseller için daha ucuz depolama sınıfına geçiş.

## 11. Riskler ve önlemler

- **Arka plan silme kalitesi** (karışık zemin, askıdaki kıyafet) → düz zeminde çekim ipucu,
  "orijinali kullan" seçeneği; gerekirse ücretli servis (remove.bg) opsiyonu.
- **Tarayıcıda model indirme süresi** (ilk seferde ~birkaç MB) → önbelleğe alınır, ilerleme gösterilir.
- **Yapay zekâ maliyeti/kötüye kullanım** → kota + rate limit; kural motoru her zaman yedek.
- **Fotoğraf boyutu** → istemcide küçültme, sunucuda WebP.

---

## 12. Senden gerekecekler

- Netlify, Railway, MongoDB Atlas hesapları (deploy aşamasında adım adım anlatırım).
- AWS: bir S3 bucket + **sadece o bucket'a yetkili** bir IAM kullanıcısının erişim anahtarları.
  Anahtarlar sohbete/koda yazılmaz; Railway ortam değişkenlerine (yerelde `.env`) girilir.
- Qwen için sağlayıcı anahtarı (OpenRouter / DashScope) veya kendi Ollama sunucun.
- Profil için stil tercihlerin (uygulama içinden de girilebilir).

---

## 13. Durum (uygulandı)

| # | Aşama | Durum |
|---|---|---|
| 0 | Kurulum | ✅ Monorepo, ortak paket, Fastify API, MongoDB, oturum sistemi, PWA, Netlify/Railway ayarları, CI |
| 1 | Gardırop | ✅ Toplu yükleme, tarayıcıda arka plan silme (+ düz zemin yedeği), renk çıkarma, form, filtreler, arşiv |
| 2 | Yapay zekâ etiketleme | ✅ Qwen görsel model, JSON doğrulama + yeniden deneme, kota |
| 3 | Kombin önerisi | ✅ Kural motoru, puanlama, Qwen stilist, hava durumu (Open-Meteo), "Bugün" ekranı, kolaj |
| 4 | Geri bildirim & geçmiş | ✅ Beğen/beğenme, kaydet, giydim (geri alınabilir), tekrar önleme, ikili öğrenme |
| 5 | Ekstralar | ✅ Haftalık plan, valiz listesi, istatistikler, eksik parça önerileri, elle kombin |
| 6 | Satışa hazırlık | ✅ Planlar/kota, Stripe abonelik, e-posta doğrulama, şifre sıfırlama, tanıtım sayfası, KVKK onayı / dışa aktarma / silme |

Kurulum ve deploy adımları: README.md
