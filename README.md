# fashionOS

Gardırobunu dijitalleştiren ve **sadece senin kıyafetlerinden** hava durumuna, etkinliğe ve tarzına göre kombin öneren web uygulaması (telefona kurulabilir PWA).

- **Gardırop:** fotoğraf çek → arka plan tarayıcıda silinir → renkler çıkarılır → Qwen (açık kaynak yapay zekâ) kategori, kumaş, mevsim, resmiyet gibi bilgileri doldurur → kontrol et, kaydet. Toplu yükleme desteklenir.
- **Bugün:** şehrinin hava durumuna göre günün 3 kombini; beğen, beğenme, kaydet, "giydim".
- **Stilist:** etkinlik + not ("müşteri sunumu var, akşam yemeğe geçeceğim") + istersen "şu parça mutlaka olsun" → kombin. Elle kombin oluşturma da var.
- **Kombinlerim:** haftalık plan (gün için öneri al ve planla), kayıtlılar, giyim geçmişi (geri alınabilir).
- **Öğrenme:** beğenilen ikililer öne çıkar, beğenilmeyen kombin bir daha gelmez, son giyilenler dinlendirilir.
- **Valiz:** seyahat günlerinin hava tahminine göre gün gün kombin ve en kısa parça listesi.
- **Analiz:** kategori ve renk dağılımı, hiç giyilmeyenler, giyim başı maliyet, eksik temel parçalar.
- **SaaS altyapısı:** çok kullanıcılı, plan ve kota sistemi, Stripe abonelik, e-posta doğrulama, şifre sıfırlama, KVKK (verilerimi indir / hesabımı sil).

## Mimari

```
apps/web         React + Vite + Tailwind PWA        → Netlify
apps/api         Fastify + Mongoose (TypeScript)    → Railway (Dockerfile)
packages/shared  Ortak sözlük, renk uyumu, zod şemaları, tipler
```

Netlify `/api/*` isteklerini Railway'e proxy'ler. Böylece her şey tek alan adından çalışır ve oturum çerezleri iOS Safari'de de sorunsuz olur. Fotoğraflar özel bir **AWS S3** bucket'ında durur ve tarayıcıya 1 saatlik imzalı URL'lerle sunulur.

### Kombin motoru (`apps/api/src/engine`)

1. **Kurallar** (`outfits.ts`): hissedilen sıcaklık → üst/alt kalınlığı, dış giyim gerekliliği, katmanlama (tişört + kazak + mont); yağmurda sandalet/süet elenir; etkinliğe göre resmiyet aralığı.
2. **Puanlama:** renk uyumu (nötrler, ton-sür-ton, analog, tamamlayıcı; Lab renk uzayında), resmiyet tutarlılığı, desen çatışması, stil ve renk tercihleri, tazelik, geri bildirim.
3. **Qwen stilist** (`stylist.ts`): en iyi ~12 farklı aday modele gönderilir. Model 3 tanesini seçer, aksesuar ekler ve Türkçe açıklama yazar. **Sadece verilen parça kodlarını kullanabilir**; geçersiz yanıtlar elenir. Yapay zekâ yoksa, hata verirse veya kota dolduysa kural motoru sonuçları kullanılır, uygulama her durumda çalışır.

## Yerelde çalıştırma

Gereksinimler: Node 20+, MongoDB (yerel veya Atlas).

```bash
npm install
cp apps/api/.env.example apps/api/.env      # STORAGE_DRIVER=local yaparak S3'süz deneyebilirsin
docker run -d -p 27017:27017 mongo:7         # yerel MongoDB (Atlas kullanıyorsan gerek yok)
npm run dev                                  # API :4000, web :5173 (Vite /api'yi API'ye yönlendirir)
```

Testler: `npm test` (MongoDB gerekir). 33 test: motor kuralları, kimlik doğrulama, kullanıcı izolasyonu, yükleme, öneri, sahte Qwen sunucusuyla yapay zekâ akışı, giyim geçmişi, KVKK. S3 sürücüsü testi: `S3_TEST_ENDPOINT=http://127.0.0.1:9090 npx vitest run test/s3.test.ts -w @fashionos/api` (adobe/s3mock ile).

## Yayına alma (adım adım)

### 1. MongoDB Atlas
1. cloud.mongodb.com → ücretsiz **M0** küme (bölge: Frankfurt).
2. Database Access → kullanıcı oluştur. Network Access → `0.0.0.0/0` (Railway IP'leri sabit değil).
3. Connect → Drivers → bağlantı dizesini kopyala, sonuna veritabanı adı olarak `/fashionos` ekle → `MONGODB_URI`.

### 2. AWS S3
1. S3 → Create bucket: ad `fashionos-uploads` (başka ad seçersen aşağıdaki politikada da değiştir), bölge `eu-central-1`, **Block all public access: açık**.
2. IAM → Policies → Create → JSON → [`docs/s3-iam-policy.json`](docs/s3-iam-policy.json) içeriğini yapıştır.
3. IAM → Users → yeni kullanıcı (konsol erişimi yok) → bu politikayı bağla → Security credentials → Access key oluştur → `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
4. CORS ayarı gerekmez (görseller `<img>` ile yüklenir).

### 3. Yapay zekâ (Qwen)
Uygulama OpenAI uyumlu her sağlayıcıyla çalışır; sadece `AI_BASE_URL`, `AI_API_KEY`, `AI_VISION_MODEL` değişir:

| Seçenek | Ayar | Not |
|---|---|---|
| **OpenRouter** (varsayılan) | `https://openrouter.ai/api/v1`, model `qwen/qwen3.8-27b` | En kolayı; kullandıkça öde, düşük maliyet. Ücretsiz (`:free`) Qwen varyantları varsa model adını onunla değiştirebilirsin (hız sınırlı). |
| **Alibaba DashScope** | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`, ör. `qwen-vl-max` | Qwen'in resmi API'si, başlangıçta ücretsiz kota verir. |
| **Ollama** (kendi sunucun) | `http://SUNUCU:11434/v1`, ör. `qwen3-vl`; anahtar gerekmez | Tamamen ücretsiz, ama GPU'lu bir makine gerekir. |

Modelin JSON modu desteği yoksa `AI_JSON_MODE=false` yap; uygulama yanıttaki JSON'u yine ayıklar ve doğrular.

### 4. Railway (API)
1. railway.com → New Project → Deploy from GitHub repo → `fashionOS`.
2. Kökteki `railway.json` sayesinde `apps/api/Dockerfile` ile derlenir; health check `/api/health`.
3. Variables: `.env.example`'daki değerler. Üretimde mutlaka: `NODE_ENV=production`, `MONGODB_URI`, `SESSION_SECRET` (≥32 karakter), `APP_URL` (Netlify adresi), S3 ve AI değişkenleri.
4. Settings → Networking → Generate Domain → ör. `https://fashionos-api.up.railway.app`.

### 5. Netlify (web)
1. app.netlify.com → Add new site → Import from GitHub → `fashionOS`. Kökteki `netlify.toml` derleme ayarlarını içerir.
2. Environment variables: `API_ORIGIN=https://fashionos-api.up.railway.app` (Railway adresi).
3. Deploy. Kendi alan adını bağlarsan Railway'deki `APP_URL`'i de güncelle.

### 6. İsteğe bağlı
- **E-posta:** `SMTP_URL` (SendGrid, Mailgun, Yandex vb.). Boşsa e-postalar Railway log'una yazılır.
- **Ödeme (Stripe):** Ürün + aylık fiyat oluştur → `STRIPE_PRICE_PRO`; webhook: `https://SITE/api/billing/webhook` (olaylar: `checkout.session.completed`, `customer.subscription.*`) → `STRIPE_WEBHOOK_SECRET`.
  > ⚠️ Stripe, Türkiye'de kurulu şirketleri doğrudan kabul etmiyor. Türkiye'den satış için iyzico veya Paddle / Lemon Squeezy gibi bir "merchant of record" gerekebilir. Ödeme kodu tek bir dosyada (`apps/api/src/lib/billing.ts`) olduğu için sağlayıcı değişikliği oradan yapılır.

## Varsayılan stil profili

Yeni kullanıcılar smart casual, minimal ve klasik bir profille başlar: nötr renkler (lacivert, beyaz, gri, siyah, bej, denim, camel), şehir İstanbul. Not: "Sade, kaliteli görünen, iş toplantısından akşam yemeğine geçebilen kombinler". Hepsi **Profil** ekranından değiştirilebilir (`packages/shared/src/schemas.ts` → `DEFAULT_PROFILE`).
