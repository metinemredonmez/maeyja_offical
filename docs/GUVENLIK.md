# MAEYJA — Güvenlik Kontrol Listesi

> 28 Ekim 2026 · Kapsam: `backend/` (NestJS 11 + Prisma + PostgreSQL), `web/` + `admin/` (Next.js 16, BFF proxy + httpOnly cookie), nginx, Ubuntu VPS + pm2 (Docker yok).
> Durumlar kodun ve konfigürasyonun **statik okunmasına** dayanır (backend, `deploy/`, `ecosystem.config.js` ve web/admin'in o günkü taslağı). Canlı test / sızma testi yapılmadı; rehberlerin ilkesi: kanıtı olmayan kontrol "Geçti" sayılmaz (SIK §3). Web/admin henüz yazılıyor, o satırlar taslağa göre işaretlidir.

## 1. Kısa özet

**Kaynak rehberler** (tabloda kısaltmalarla anılır):

| Kısaltma | Rehber (dosya) | Ne için kullanıldı |
|---|---|---|
| **KG** | *Güvenlik Değerlendirmesi — Kapsam Genişletme* (`Guvenlik-Degerlendirmesi-Kapsam-Genisletme.pdf`, 6 s) | Kalan riskler R1–R3, test aileleri T1–T12, parola hizası (§5), 4 fazlı yol haritası (§6) |
| **SIK** | *Kurumsal Güvenlik Sıkılaştırma ve Doğrulama Rehberi* (`Kurumsal_Guvenlik_Sikilastirma_Rehberi_Detayli.pdf`, 34 s) | 90 kontrol kartı (ARC/INP/BUS/WEB/API/FIL/AUT/SES/AZ/TOK/KEY/NET/OPS/DAT/LOG/EXT/RES/PWD), DVT-01…12 kabul senaryoları, P0/P1/P2 planı |
| **W1** | *Kurumsal Web Uygulamaları Güvenlik Değerlendirmesi / OWASP ASVS Rehberi* (`Kurumsal_Web_Guvenligi_ve_OWASP_ASVS_Rehberi.pdf`, 17 s; SIK'te "D2") | Bulgular A1–B4, §7.1–7.18 kontrol aileleri, hızlı kontrol listesi |
| **W2** | *Kurumsal Web Güvenlik Değerlendirme Rehberi v2* (`Kurumsal-Web-Guvenligi-ASVS-Rehberi-v2.pdf`, 20 s; SIK'te "D3") | İzlenebilirlik matrisi, §7 "nasıl test edilir", §8 parola, §9 olgunluk, §10 plan |

**Hedef standart:** OWASP **ASVS 5.0 Seviye 2** (internet'e açık, kişisel veri + ödeme akışı olan uygulama için rehberlerin önerdiği profil — W1 §7, W2 §9); kimlik, yönetici ve anahtar yönetimi akışlarında **L3** eğilimli (MFA, rotasyon, kayıt bütünlüğü). Parola/kimlik için **NIST SP 800-63B-4**, API tarafı için **OWASP API Security Top 10** (BOLA/BFLA/BOPLA/kaynak tüketimi). "ASVS" sütunundaki V-numaraları SIK §4'ün **aile eşlemesidir**, tam gereksinim kimliği değildir; sertifikasyon gerekirse madde madde eşleştirilmelidir (SIK §3).

**Öncelik:** P0 = yayın öncesi / ilk 15 gün (SIK §5, W2 §10) · P1 = 15–45 gün · P2 = 45–90 gün. Uygulanabilir P0 satırı ⬜ iken normal yayın onayı verilmez (SIK §5 "yayın kapısı").
**Durum:** ✅ kodda/konfigte var (dosyada doğrulandı) · ⬜ yapılacak ("kısmen var" ise notta yazar) · ➖ bu projede uygulanamaz.

**Tablo özeti (ilk yazım):** 109 kontrol — 29 ✅ · 79 ⬜ · 1 ➖. **28 Ekim akşamı uygulananlar** (✅'ye çevrildi): #5 kilitleme, #6–7 MFA, #11/#18 atomik token, #12 changePassword, #16 JWT iss/aud; ayrıca bölüm 3'teki P0 1 (LISTEN_HOST), 3 (prod env/seed), 7–8 (web BFF allowlist + CSRF), 9 (API tarafı sanitize-html, DTO boyut sınırı), 13 (multer 2.5.0) kod/konfigde yapıldı; 2 ve 10 nginx/admin tarafında hazırlandı. **Sunucuda yapılacaklar** (11, 12, 14, 15 ve bölüm 4) Emre'nin elinde.

**Bu incelemenin en önemli bulguları**
1. Sunucu katmanı henüz sertleştirilmemiş: HSTS/TLS ayarı yok (nginx yalnız :80), `app.listen(port)` tüm arayüzlerde dinliyor (ufw yoksa `:4000` doğrudan açık ve `X-Forwarded-For` sahtelenebilir), pm2 muhtemelen root altında, ufw/fail2ban/SSH sertleştirmesi/otomatik yama tarifte yok, **Node 20 Nisan 2026'da EOL oldu**.
2. `.env.example` → `SWAGGER_ENABLED=true` ve `SEED_ADMIN_PASSWORD=ChangeMe!2026`; SERVER-SETUP `cp .env.example .env` der, `deploy.sh` her deploy'da `db:seed` çalıştırır → prod'da Swagger açık + bilinen SUPER_ADMIN parolası riski.
3. Kimlik doğrulamada yalnız IP bazlı throttle var (hesap bazlı gecikme yok, yönetici MFA yok, `changePassword` oturumları düşürmüyor, refresh/reset token tüketimi atomik değil).
4. Web BFF (`web/app/api/[...path]/route.ts` taslağı) tüm API'yi açık proxy'liyor: `admin/*` ve `auth/admin/login` müşteri sitesinden geçiyor ve `auth/admin/login` yanıtında token'lar JSON'da tarayıcıya dönüyor; Origin/CSRF kontrolü yok.
5. `npm audit --omit=dev` (backend): 7 bulgu (5 high). Eyleme dönük olan: `@nestjs/platform-express` içindeki `multer@2.4.0` (DoS). Admin CSS/CSP, CMS HTML sanitizasyonu (API tarafı), CSV formül enjeksiyonu, iyzico mutabakatı ve yedekleme de P0/P1'de.

## 2. Kontrol tablosu

Numaralar tablo boyunca süreklidir; kategori her satırın başında kalın yazılmıştır.

| # | Kontrol | Kaynak (rehber + bölüm/ASVS) | Katman | Öncelik | Durum | Uygulama notu (bu projede ne yapılacak) |
|---|---|---|---|---|---|---|
| 1 | **Kimlik** Parola hash: bcrypt cost 12; kullanıcı yokken sabit `DUMMY_HASH` ile karşılaştırma | SIK §7.18 PWD-04 · W2 §7.7 · ASVS V6.2 | backend | P1 | ✅ | `auth.service.ts` (`BCRYPT_ROUNDS=12`, `DUMMY_HASH`); `seed.ts` ve `users.service.createStaff` de 12. `bcryptjs` saf JS (CPU'yu bloklar); P2: argon2id (OWASP başlangıç m=19 MiB, t=2, p=1) + girişte yeniden hash. |
| 2 | **Kimlik** Parola politikası NIST 800-63B-4'e hizalı olsun (uzunluk > kompozisyon) | KG §5 · W2 §8 · SIK §7.18 PWD-01/05 · ASVS V6.2 | backend, web, admin | P1 | ⬜ | `auth/dto/auth.dto.ts` `PASSWORD_RULE` şu an min 8 + harf/rakam zorunlu + max 72. Yap: yalnız-parola hesapta min 15, kompozisyon regex'ini sil, `@MinLength(15) @MaxLength(128)`, boşluk/Unicode serbest, sessiz `trim` yok. `RegisterDto`, `ResetPasswordDto`, `ChangePasswordDto` ve `users.dto.ts CreateStaffDto` tek sabiti kullansın; formlarda "göster" düğmesi + yapıştırmaya izin. 15'in altına inilirse yazılı risk kabulü (SIK §3). |
| 3 | **Kimlik** bcrypt 72 bayt sınırında sessiz kesme olmasın | SIK §7.18 PWD-02 · ASVS V6.2 | backend | P1 | ⬜ | `.{8,72}` karakter sayar ama bcrypt **bayt** keser (Türkçe harf = 2 bayt). Çözüm: `bcrypt.hash(createHash('sha256').update(pw).digest('base64'), 12)` ön-hash (eski hash'ler için `hashVersion` alanı ile geçiş) ya da argon2id. DTO'da `@MaxLength(128)`. |
| 4 | **Kimlik** Sızmış/tahmin edilebilir parola kontrolü (blocklist) | SIK §7.18 PWD-03 · KG §5 · W2 §8 · ASVS V6.2 | backend | P1 | ⬜ | `PasswordPolicyService`: HIBP k-anonymity (`api.pwnedpasswords.com/range/<SHA1 ilk 5>`, tam parola gitmez, 2 sn timeout) + yerel 10k'lık liste (`src/common/data/common-passwords.txt`); servis çökerse **yerel listeye düş + uyar** (sessiz bypass yok). E-posta/ad/"maeyja" içeren parolaları reddet. register / reset / change / createStaff akışlarında çağır. |
| 5 | **Kimlik** Hesap bazlı brute-force koruması (kademeli gecikme, kalıcı kilit değil) | KG R1 · SIK §7.7 AUT-02, §7.17 RES-01 · W2 §6.1 R1 · ASVS V6.2/V2.4 | backend | P0 | ✅ | Yapıldı (28 Eki): `auth/login-guard.service.ts` — hesap 5 / IP 20 hatalı deneme → 15 dk kilit (429), bellek-içi (tek pm2 fork; cluster'a geçilirse Redis'e taşı). Önceki not: Şu an yalnız IP: `STRICT` 8/dk (`auth.controller.ts`) + global 120/dk; dağıtık saldırıda etkisiz. `User`'a `failedLogins Int`, `lockedUntil DateTime?` (ya da `LoginAttempt` tablosu). `login()`: kilitliyse yine bcrypt çalıştır (zamanlama), genel 429 "Çok fazla deneme"; 5. hatadan sonra `lockedUntil = now + min(2^(n-5) dk, 30 dk)`; başarıda sıfırla; `increment` ile atomik. Var olmayan e-posta için bellek-içi sayaç (aynı davranış → varlık sızmaz). Kilit saldırganın mağduru dışarıda tutmasını sağlamasın: parola sıfırlama kilitten bağımsız çalışsın. Admin için eşik 5/15 dk. |
| 6 | **Kimlik** Yönetici (EDITOR/ADMIN/SUPER_ADMIN) için zorunlu MFA (TOTP) | SIK §7.7 AUT-01 · W1 §1.1 · W2 §1.1, R4 · KG §6 Faz 2 · ASVS V6 | backend, admin | P0 | ✅ | Yapıldı (28 Eki): `auth/mfa.service.ts` — otplib TOTP, AES-256-GCM şifreli sır (`APP_ENCRYPTION_KEY`), `/auth/login/mfa` ikinci adım, 8 yedek kod (sha256, tek kullanım), `MFA_REQUIRED_FOR_STAFF`. Önceki not: `otplib` + `User.totpSecretEnc`, `totpEnabledAt`, `recoveryCodes` (SHA-256 hash'li 10 tek-kullanımlık kod). `POST /auth/admin/login` parola doğrulayınca `{ mfaRequired, mfaToken }` (JWT `typ:'mfa'`, 5 dk) döner; `POST /auth/admin/login/mfa { mfaToken, code }` oturum verir. Kod ±1 adım, **aynı time-step iki kez kabul edilmez**, MFA denemesi 5/5 dk. TOTP sırrı AES-256-GCM (`MFA_ENC_KEY`, 32 bayt base64, Joi'ye ekle). `STAFF_MFA_REQUIRED=true`: MFA'sız staff token'ı yalnız `/auth/mfa/enroll` rotalarına geçer. Admin UI: QR (`qrcode`) + kurulum + kurtarma kodları ekranı. Passkey/WebAuthn (`@simplewebauthn/server`) P2. |
| 7 | **Kimlik** MFA kaldırma/kurtarma ve staff parola sıfırlamasının MFA'yı atlamaması | SIK §7.7 AUT-04 · KG T3 · W2 §7.7 | backend, süreç | P0 | ✅ | Yapıldı (28 Eki): kaldırma şifre + kod ister; MFA açılınca eski oturumlar düşer. Kurtarma: yedek kodlar; SUPER_ADMIN için CLI sıfırlama henüz yok (P1). Önceki not: Faktör ekleme/kaldırma yeniden doğrulama ister + kayıt + e-posta bildirimi. Kurtarma kodu tek yönlü hash. Acil sıfırlama yalnız sunucuda: `npm run mfa:reset -- <email>` (audit'e yazar). `forgotPassword` staff'a `ADMIN_URL` linki gönderiyor; reset sonrası giriş yine MFA istemeli (reset oturum vermez). |
| 8 | **Kimlik** Kullanıcı numaralandırma (enumeration) yok | SIK §7.7 AUT-02 · KG T3 · W2 §7.7 · ASVS V6 | backend, web | P1 | ⬜ | login ve forgot-password genel yanıt veriyor ✅ ama `auth.service.register()` `Bu e-posta ile kayıtlı bir hesap var` (400) döner. Yap: aynı 200/202 yanıt + mevcut adrese "zaten hesabınız var / şifre sıfırla" e-postası; en azından CAPTCHA (#14). Misafir sipariş sorgusu (`orders/lookup`) zaten e-posta+numara ister. |
| 9 | **Kimlik** Giriş yanıtı genel ve zamanlama-eşit | SIK §7.7 AUT-02 · W2 §7.7 | backend | P1 | ✅ | `login()`: kullanıcı yokken de `bcrypt.compare(…, DUMMY_HASH)`; hata `E-posta veya şifre hatalı`; "askıya alınmış" mesajı yalnız doğru parola sonrası. |
| 10 | **Kimlik** Reset/verify token'ları: rastgele, hash'li saklı, kısa ömürlü, tek aktif | SIK §7.7 AUT-03 · KG T3 · W2 §7.7 · ASVS V6.4 | backend | P0 | ✅ | `generateToken()` 32 bayt `base64url`, DB'de yalnız SHA-256 (`token.util.ts`); reset 1 sa, verify 48 sa; yeni token öncekini `usedAt` ile kapatır; `resetPassword` tüm refresh token'ları iptal eder; linkler `WEB_URL/ADMIN_URL` config'inden üretilir (Host başlığı kullanılmaz). Öneri: reset TTL → 30 dk. |
| 11 | **Kimlik** Reset/verify token tüketimi atomik olsun (paralel kullanım yok) | SIK §7.7 AUT-03, §7.3 BUS-02 · KG T3 · DVT-06 | backend | P1 | ✅ | Yapıldı (28 Eki): `consumeAuthToken` koşullu `updateMany` ile atomik. Önceki not: `consumeAuthToken` find → update (koşulsuz). Yap: `const r = await prisma.authToken.updateMany({ where:{ id, usedAt:null, expiresAt:{ gt:new Date() } }, data:{ usedAt:new Date() } }); if (r.count!==1) throw …`. İki paralel `reset-password` ile test et (DVT-06). |
| 12 | **Kimlik** `changePassword` diğer oturumları düşürsün + hız sınırı | W2 §7.7–7.8 · KG T1/T3 · SIK §7.8 SES-04 · ASVS V7 | backend | P0 | ✅ | Yapıldı (28 Eki): `changePassword` tüm refresh token'ları iptal eder, yeni oturum döner; `@Throttle(STRICT)`. Önceki not: `auth.service.changePassword()` yalnız hash günceller; `resetPassword` ise refresh token'ları iptal eder. Aynı `$transaction` içinde `refreshToken.updateMany({ where:{ userId, revokedAt:null }, data:{ revokedAt:new Date() } })` + yeni oturum döndür (`issueSession`); BFF yeni token'ları cookie'ye yazsın. Endpoint'e `@Throttle(STRICT)` ekle (şu an yalnız global 120/dk → mevcut-parola brute-force). "Parolanız değişti" e-postası gönder. |
| 13 | **Kimlik** Token taşıyan URL'ler loga/Referer'a sızmasın | SIK §7.4 WEB-04, §7.5 API-03 · KG T9 · ASVS V14 | nginx, web | P1 | ⬜ | `reset-password?token=…` ve `verify-email?token=…` nginx access log'unda düz metin kalır (token 1 sa geçerli). nginx `log_format` `$request_uri` yerine `$uri` kullansın (bölüm 5 `mj`), bu sayfalara `Referrer-Policy: no-referrer`, sayfa token'ı okuyunca `history.replaceState` ile URL'yi temizlesin; uzun vadede e-posta linkinde `#token=` (fragment sunucuya gitmez). |
| 14 | **Kimlik** Bot koruması: register/forgot/contact/newsletter/stock-alert için CAPTCHA (adaptif) | KG R1/R2 · SIK §7.7 AUT-05 · W1 §3 A3 · ASVS V6.2 | backend, web | P1 | ⬜ | Cloudflare Turnstile (veya hCaptcha): istemci token'ı BFF'den geçer, API `siteverify` ile doğrular (token provider tarafında tek kullanımlık; sırrı `TURNSTILE_SECRET` env + Joi). Login'de yalnız 3 başarısız denemeden sonra. CAPTCHA tek savunma değildir (KG R2); #5 ve nginx limitleriyle birlikte. |
| 15 | **Oturum** Access JWT 15 dk, `typ:'access'` doğrulaması | SIK §7.10 TOK-01 · KG T1 · W2 §7.10 | backend | P0 | ✅ | `app.module.ts` `JwtModule` (`JWT_ACCESS_TTL=15m`); `jwt-auth.guard.ts` `payload.typ !== 'access'` → reddeder; geçersiz token public rotada misafir sayılır. |
| 16 | **Oturum** JWT algoritma pinleme + `iss`/`aud` doğrulaması | SIK §7.10 TOK-01/02 · KG T1 · W2 §7.10 · ASVS V9 | backend | P1 | ✅ | Yapıldı (28 Eki): `JwtModule` HS256 + `issuer: maeyja-api`, `audience: maeyja` (sign + verify). Önceki not: `JwtModule` → `signOptions:{ algorithm:'HS256', issuer:'maeyja-api', audience:'maeyja' }`, `verifyOptions:{ algorithms:['HS256'], issuer:'maeyja-api', audience:'maeyja' }`. Mobil/BFF aynı token'ı kullandığı için aud tek. Çoklu anahtar/`kid` P2 (bkz. #23). |
| 17 | **Oturum** Refresh token rotasyonu + yeniden kullanım tespiti (aile iptali) | SIK §7.8 SES-05 · KG T1 · W2 §7.10 · ASVS V7 | backend | P0 | ✅ | `auth.service.refresh()`: opak 48 bayt token, DB'de SHA-256; kullanılmış token gelirse kullanıcının tüm aktif refresh token'ları iptal + `logger.warn`. `cleanup` cron'u eski kayıtları siler. |
| 18 | **Oturum** Refresh rotasyonu atomik olsun (paralel kullanım ikiye bölünmesin) | SIK §7.8 SES-05 · DVT-05 · §7.3 BUS-02 | backend | P1 | ✅ | Yapıldı (28 Eki): `refresh()` koşullu `updateMany` ile atomik. Önceki not: `refresh()` `findUnique` → koşulsuz `update({ where:{id} })`; aynı token ile iki eşzamanlı istek ikisi de oturum alır (reuse tespitini atlatır). Yap: `const c = await prisma.refreshToken.updateMany({ where:{ id: record.id, revokedAt:null }, data:{ revokedAt:new Date() } }); if (c.count===0) → reuse yolu`. DVT-05 testi ekle. |
| 19 | **Oturum** BFF'de tek-uçuşlu (single-flight) yenileme + çalışan refresh akışı | SIK §7.8 SES-05 · DVT-05 · KG T1 | web, admin | P1 | ⬜ | Taslakta: (a) `mj_rt` cookie `Path=/api/auth` → `/api/orders/...` isteklerinde gelmez, `route.ts`'in 401→refresh yolu çalışmaz; (b) `auth/refresh` yanıtında token'lar silinip `setTokens` yalnız login/register için çağrılıyor → yenileme token'ı kaybeder; (c) paralel isteklerde aynı refresh iki kez harcanır → API "reuse" sayıp tüm oturumları düşürür. Yap: `/api/auth/refresh` özel route (cookie'den oku, yeni cookie'leri yaz), `Map<refreshValue, Promise>` ile single-flight, istemci 401'de bu route'u bir kez çağırıp isteği tekrarlasın. |
| 20 | **Oturum** Yetki/hesap değişikliği anında etkili olsun (15 dk açığı) | SIK §7.8 SES-04, DVT-04 · W2 §7.8 · SIK §6, §9.2 | backend | P1 | ⬜ | `JwtAuthGuard` yalnız imzaya bakıyor; pasifleştirilen/rolü düşen staff access token süresi dolana dek çalışır (`users.service.adminUpdate` refresh'i iptal eder, access'i değil). Yap: `RolesGuard` staff rotalarında kullanıcıyı DB'den okuyup `isActive && !deletedAt && role` doğrulasın (30 sn bellek cache) ya da `User.tokenVersion` + JWT `ver`. Admin access TTL 5 dk (BFF sessiz yeniler). |
| 21 | **Oturum** Idle + mutlak zaman aşımı; oturum listesi ve "her yerden çık" | SIK §7.8 SES-03 · KG T1 · SIK §6 · W2 §7.8 | backend, admin | P1 | ⬜ | `JWT_REFRESH_TTL_DAYS` tek değer (30 g). Staff: 15 dk idle + 8 sa mutlak → `RefreshToken.familyId` + `familyStartedAt` (rotasyonda taşınır), `expiresAt = min(now+idle, familyStartedAt+8sa)`. Müşteri 30 g kalabilir. `GET /me/sessions` (ip/userAgent alanları zaten var), `DELETE /me/sessions/:id`, `POST /auth/logout-all`. |
| 22 | **Oturum** Çıkışta sunucu tarafı iptal | SIK §7.8 SES-04 · KG T1 | backend, web | P1 | ✅ | `auth.service.logout()` refresh token'ı `revokedAt` ile kapatır; web BFF `logout()` bunu çağırıp cookie'leri siler. |
| 23 | **Oturum** JWT sırrı zayıf/varsayılanken prod başlamasın; rotasyon prosedürü | SIK §7.11 KEY-01/03 · W1 B4 · W2 B4, R3 · ASVS V11.2 | backend | P0 | ✅ | `env.validation.ts` prod'da `JWT_ACCESS_SECRET` min 32 + örnek değer `invalid(...)`. Doğrula: `NODE_ENV=production JWT_ACCESS_SECRET=dev-only-access-secret-change-me-please-32chars node dist/main.js` açılmamalı (jest testi ekle). Refresh token'lar opak/DB'de olduğundan sırrı değiştirmek yalnız access token'ları düşürür (≤15 dk) → acil rotasyon = `.env` + `pm2 restart` (#77). `kid`'li çoklu anahtar P2. |
| 24 | **Erişim** Varsayılan-reddet kimlik doğrulama; `@Public()` açıkça işaretli | SIK §7.5 API-01, §7.9 AZ-01 · W2 §7.9 · ASVS V8/V4 | backend, web | P0 | ✅ | `app.module.ts`: `ThrottlerGuard → JwtAuthGuard → RolesGuard` global. Web `proxy.ts` yalnız iyimser (cookie var mı) kapı; asıl yetki API + `currentUser()`'da — Next middleware/proxy atlatma açıkları (ör. CVE-2025-29927) için bu iki katman korunmalı. Admin `proxy.ts` yazılırken aynı kural. |
| 25 | **Erişim** RolesGuard fail-closed olsun (`/admin/*` rotası `@Roles`'suz kalamaz) | SIK §7.5 API-01, ARC-02 · KG T5 (BFLA) · ASVS V8 | backend | P1 | ⬜ | `roles.guard.ts` `@Roles` yoksa `true` döner → yeni admin controller'da unutulursa her giriş yapmış müşteri erişir (şu an tüm admin controller'larda `@Roles` var ✅ doğrulandı). Yap: `@Public()` olmayan ve yolu `/<API_PREFIX>/admin/` ile başlayan rotada `@Roles` yoksa 403 (`/auth/admin/login` bu desene girmez); supertest: tüm `/admin/*` rotalarını CUSTOMER token ile çağır → 403. |
| 26 | **Erişim** Nesne düzeyi yetki (BOLA/IDOR): müşteri nesneleri sahibine kilitli | SIK §7.9 AZ-01/04 · KG T5 · W2 §7.5, §7.9 · ASVS V8 | backend | P0 | ✅ | `me/orders/:no` → `where {orderNumber, userId}`; `me/addresses/:id` → `ownAddress` (`{id,userId}`); wishlist/cart sahibe bağlı; misafir `orders/lookup`, `/pay`, `/returns` numara **+ e-posta** eşleşmesi ister; misafir sepet token'ı 24 bayt rastgele. Test: A kullanıcısıyla B'nin sipariş/adres id'si → 404 (DVT-03 benzeri). |
| 27 | **Erişim** Mass-assignment: istemci yalnız izinli alanları yazar | SIK §7.5 API-02, §7.2 INP-01 · W2 §7.5 · ASVS V4 | backend | P0 | ✅ | `main.ts` `ValidationPipe({ whitelist:true, forbidNonWhitelisted:true, transform:true })`; admin PATCH DTO'ları alan listeli (`AdminUpdateUserDto` vb.); `role/isActive` yalnız yetkili yoldan. |
| 28 | **Erişim** Yetki yükseltme koruması (kendi rolü, ADMIN→staff, createStaff) | SIK §7.9 AZ-05 · KG T5 · W2 §7.9 | backend | P0 | ✅ | `users.service.adminUpdate`: staff'a dokunmak yalnız SUPER_ADMIN, kendi rol/durumunu değiştirememe, rol/`isActive` değişince refresh iptali; `createStaff` yalnız `@Roles(SUPER_ADMIN)`. Açık kalan (P2): iki SUPER_ADMIN'in birbirini eşzamanlı düşürmesi → transaction içinde `count(aktif SUPER_ADMIN) > 1` kontrolü. |
| 29 | **Erişim** Hassas işlemlerde yeniden doğrulama (step-up, ≤5 dk) | SIK §6 (kritik işlem yeniden doğrulama), §7.7 AUT-04 · W2 §7.8 · ASVS V7 | backend, admin | P1 | ⬜ | MFA sonrası JWT'ye `amr:['pwd','otp']` + `auth_time`; şu uçlara `@RequireRecentAuth(300)`: MFA kaldırma, rol değişimi, `PUT /admin/settings/:key` (özellikle `bankTransfer` IBAN değişimi = para yönlendirme), `PATCH /admin/orders/:id/status` ile `refundOnProvider`, `export.csv` uçları, `POST /admin/push`, `POST /admin/users`. |
| 30 | **Erişim** Yanıtlarda alan allowlist'i (BOPLA/over-fetching) | SIK §7.5 API-02 · W2 §7.14 · ASVS V14/V8 | backend | P1 | ✅ | `publicUser()` ve `customerOrderSelect` açık alan listesi; `Payment.raw` müşteri yanıtına seçilmiyor; hata gövdesinde stack yok. Yeni DTO/select eklerken aynı kural; Swagger şemasıyla yanıt sözleşmesi testi P2. |
| 31 | **Erişim** TCKN/VKN'yi müşteri/misafir yanıtında maskele | SIK §7.14 DAT-01 · W2 §7.14 · KVKK | backend | P1 | ⬜ | `customerOrderSelect` `billingAddress: true` → `identityNumber`/`taxNumber` düz döner; misafir `orders/lookup` yalnız e-posta+numara ile bunu açar. `withPaymentInfo` içinde maskele (`*******1234`); admin tam değeri görür (fatura için) ve görüntüleme audit'lenir. |
| 32 | **Girdi** Şema doğrulama, boyut ve sayfalama tavanları | SIK §7.2 INP-01, §7.17 RES-02 · W2 §7.2, §7.5 · ASVS V1/V4 | backend | P0 | ✅ | class-validator DTO'ları (`MaxLength`, `IsEmail`, regex'ler); `main.ts` JSON 2 MB / urlencoded 1 MB; `PaginationQueryDto` `limit ≤ 100`, `q ≤ 100`; adres ≤ 20; admin CSV `take: 5000`. Açık: CMS `body` alanları sınırsız (bkz. #34), `@Param('id')` biçim doğrulaması yok (P2: cuid regex pipe). |
| 33 | **Girdi** Enjeksiyon ve çıktı kodlama (SQL, e-posta HTML) | SIK §7.2 INP-02/03 · W2 §7.2 · ASVS V1 | backend | P0 | ✅ | Prisma parametreli; ham sorgu yalnız 2 etiketli şablon (`health.controller.ts`, `dashboard.service.ts`), `$queryRawUnsafe/$executeRawUnsafe` yok (grep). E-posta şablonlarında `esc()` (`mail.templates.ts` `layout/button/itemsTable/adminNotice`). CI'a Semgrep/eslint kuralı: `$queryRawUnsafe` yasak; `<script>` içeren ad ile şablon snapshot testi. |
| 34 | **Girdi** Stored XSS: CMS HTML (`Page.body`, `JournalPost.body`, `HomeSection.body`) temizlensin | SIK §7.4 WEB-01, §7.2 INP-03 · KG T9 · W2 §7.4 · ASVS V3 | backend, web | P0 | ⬜ | Web taslağında `lib/sanitize.ts` (`sanitize-html` allowlist) ✅ var; **API'de hiç yok** (`content/dto/*.dto.ts` `@IsString()`, uzunluk sınırı yok; mobil uygulama da aynı içeriği render edecek). Yap: yazarken `sanitize-html` + `@MaxLength(200000)`; `cleanHtml`: `http:` şemasını kaldır, `img src` yalnız `https` + upload host'u, `rel="noopener noreferrer"`; ESLint `react/no-danger`; JSON-LD'de `JSON.stringify(x).replace(/</g,'\\u003c')`. EDITOR rolü düşük güvenli olduğundan öncelik P0. |
| 35 | **Girdi** Müşteri kaynaklı veri admin panelinde yalnız düz metin render edilsin | SIK §7.4 WEB-01 · KG T9 · W2 §7.4 · ASVS V3 | admin | P0 | ⬜ | `ContactMessage.message`, `customerNote`, iade `reason`, adres/ad alanları, sipariş satırı adları admin ekranına düşer → yönetici oturumuna XSS = en yüksek etkili XSS. Admin'de `dangerouslySetInnerHTML` yasak (lint), bu alanlar `{text}` ile basılır, CSP nonce'lı (#45). Yeni admin ekranı PR şablonuna "kullanıcı verisi HTML basılmıyor" maddesi. |
| 36 | **Girdi** CSV/Excel formül enjeksiyonu | SIK §7.2 INP-05 · ASVS V1 | backend | P1 | ⬜ | `orders.service.exportCsv` `cell()` yalnız tırnaklıyor; `newsletter/export.csv` tırnaklama bile yapmıyor. Yap: `const safe=(s:string)=> /^[=+\-@\t\r]/.test(s) ? "'"+s : s;` her hücrede; newsletter export'ta da `cell()` kullan. TCKN/VKN kolonunu maskele (#31). |
| 37 | **Girdi** SSRF: sunucu çıkış çağrıları sabit uç noktalara | SIK §7.16 EXT-01/02 · KG T8 · W2 §7.16 · ASVS V13.2 | backend | P1 | ✅ | Kullanıcı kontrollü URL fetch yok; yalnız `iyzico.client.ts` (`IYZICO_BASE_URL`, 20 sn timeout) ve `push.service.ts` (sabit OneSignal endpoint). Gelecekte URL alan özellik (görsel çekme, webhook) eklenirse allowlist + redirect sonrası yeniden doğrulama + egress firewall (#94). |
| 38 | **Girdi** Açık yönlendirme (open redirect) yok | SIK §7.10 TOK-03 (redirect tam eşleşme) · KG T4 · ASVS V3 | web | P1 | ⬜ | `proxy.ts` login'e `?next=` ekliyor; login sayfası `next`'i yalnız `/` ile başlayıp `//`, `\\`, `:` içermiyorsa kullanmalı. Backend tarafı: iyzico dönüşü `WEB_URL` config'ten, `orderNumber` `encodeURIComponent` ✅. |
| 39 | **BFF** Proxy yalnız izinli API yollarına gitsin (açık proxy kapat) | SIK §7.5 API-01, §7.16 EXT-01, §7.1 ARC-02 · KG T5 · ASVS V4 | web, admin | P0 | ⬜ | `app/api/[...path]/route.ts` her `path`'i API'ye iletiyor: (i) `admin/*` müşteri sitesinden erişilir, (ii) `auth/admin/login` `AUTH_ROUTES` dışında olduğundan **token'lar JSON'da tarayıcıya iner** (httpOnly kazanımı boşa), (iii) `..%2f` ile önek dışına kaçış denenebilir. Yap: bölüm 3 #7'deki allowlist; segmentlerde `''`, `.`, `..`, `%`, `\` reddi; method allowlist; admin BFF'de tersine yalnız `admin/*` + `auth/admin/login` + `auth/admin/login/mfa` + `auth/refresh\|logout\|me`. Token döndüren her rota (change-password dahil) token-sıyırma yoluna girsin. |
| 40 | **BFF** CSRF: cookie'li durum değiştiren isteklerde Origin/Fetch-Metadata + özel başlık | SIK §7.4 WEB-03, DVT-07 · KG T2 · W2 §7.8 · ASVS V3.5 | web, admin | P0 | ⬜ | Kısmi: `mj_at` SameSite=Lax, `mj_rt` Strict. Eksik: Origin doğrulaması (kardeş alt alan / Lax boşlukları). `route.ts` başında bölüm 3 #8'deki `sameOrigin()`; `api.client.ts` her isteğe `X-Requested-With: mj` eklesin. Server Action'lar için `serverActions.allowedOrigins` + nginx `X-Forwarded-Host` (bölüm 5). Admin cookie'leri `SameSite=Strict`. Test: yabancı origin + token'sız/yanlış başlıkla `POST /api/me/addresses` → 403 ve DB değişmez (DVT-07). |
| 41 | **BFF** İletilen başlıklar allowlist'li; istemci IP'si tek kaynaktan | SIK §7.12 NET-03, §7.5 API-03 · W2 B1 · ASVS V13.4 | web, admin | P1 | ⬜ | `forward()` tarayıcı başlıklarını (origin, referer, sec-fetch-*, x-forwarded-host, forwarded, x-real-ip …) olduğu gibi API'ye kopyalıyor. Yalnız `content-type, accept, accept-language, user-agent` ilet; `X-Forwarded-For`'u nginx'in `X-Real-IP` değerine **ayarla** (gelen XFF'yi kopyalama); `X-Cart-Token` yalnız `mj_cart` cookie'sinden; gövde için üst sınır (nginx #53 + `content-length` kontrolü). |
| 42 | **BFF** Kimlikli yanıtlar önbelleğe alınmasın | SIK §7.14 DAT-03 · W1 §7.4 (son madde) · ASVS V14 | web, admin | P1 | ⬜ | BFF upstream `cache-control/etag`'i olduğu gibi geçiriyor. `/api/*` ve kimlikli RSC yanıtlarına `Cache-Control: private, no-store`; upstream `set-cookie` geçirme; helmet'in `Strict-Transport-Security` çift başlığı nginx'te `proxy_hide_header` ile düşer (bölüm 5). |
| 43 | **BFF** Cookie bayrakları: httpOnly + Secure + SameSite, refresh dar path | SIK §7.8 SES-01 · W2 §7.8 · ASVS V3.3 | web, admin | P0 | ✅ | `web/lib/cookies.ts`: `mj_at` Lax 15 dk, `mj_rt` **Strict** + `Path=/api/auth` + 30 g, `mj_cart` Lax, hepsi httpOnly, `Secure` prod'da. Web'de Lax doğru seçim (iyzico 3DS dönüşü cross-site GET navigasyonu; Strict oturumu "kapalı" gösterir). İyileştirme: `mj_at`/`mj_cart` için `__Host-` öneki; admin'de hepsi Strict + host-only (Domain yok). |
| 44 | **Başlık** CSP (web): per-request nonce + `strict-dynamic` | SIK §7.4 WEB-02 · KG T9 · W2 §7.4 · ASVS V3 | web | P0 | ✅ | `web/proxy.ts` nonce + `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `connect-src 'self'`, `upgrade-insecure-requests`. Eksik/öneri: önce `Content-Security-Policy-Report-Only` + `report-to` ile ihlal topla; `img-src https:` → `'self' data: blob: https://api.maeyja.com`; iyzico için **`paymentPageUrl` yönlendirmesi** kullan, `checkoutFormContent`'i sayfaya enjekte etme (3. taraf script + CSP gevşetme). Analitik/pixel eklenirse çerez rızası + CSP güncellemesi. |
| 45 | **Başlık** CSP (admin): nonce'lı, dar; görsel optimizer kısıtlı | SIK §7.4 WEB-02, §7.16 EXT-01 · KG T8, T9 | admin | P0 | ⬜ | `admin/next.config.ts` statik CSP `script-src 'self'` Next'in inline bootstrap/RSC script'lerini engeller (kırılırsa `unsafe-inline`'a kayma riski). Web'deki nonce desenini `admin/proxy.ts`'e taşı; `frame-src iyzipay` ve `img-src http:` kaldır; `images.remotePatterns` `hostname:'**'` (http+https) → yalnız `api.maeyja.com` (https) — açık görsel optimizer SSRF/DoS yüzeyi (web'de `IMAGE_HOSTS` ile kısıtlı ✅). |
| 46 | **Başlık** Diğer tarayıcı başlıkları: XFO, nosniff, Referrer-Policy, Permissions-Policy, COOP | SIK §7.4 WEB-04 · KG T9 · W2 §7.4, §7.12 | web, admin, backend | P1 | ✅ | Next: `next.config.ts` `headers()` (web+admin), `poweredByHeader:false`; API: `helmet()` (`main.ts`, `X-Powered-By` yok). Tek sahiplik için nginx aynı başlıkları basıp upstream kopyasını `proxy_hide_header` ile düşürür (bölüm 5) → çift başlık/çelişki olmaz. |
| 47 | **Başlık** HSTS (kademeli) | SIK §7.4 WEB-04 · W2 §7.12 · ASVS V12 | nginx | P0 | ⬜ | Hiçbir katmanda yok (nginx yalnız :80; helmet HSTS'si HTTP'de yok sayılır). 443 bloklarında `Strict-Transport-Security`: **önce `max-age=300`**, sorunsuzsa 1 hafta → 1 yıl. `includeSubDomains`/`preload` yalnız tüm alt alanlar (şu an `maeyja.com` hosting firmasında; `mail.`/webmail vb.) HTTPS olunca (WEB-04). |
| 48 | **TLS** TLS 1.2/1.3, modern şifre seti, http→https, CAA | SIK §7.12 NET-01 · W2 §7.12 · ASVS V12 | nginx, süreç | P0 | ⬜ | Şu an `certbot --nginx` ile sonradan ekleniyor, ayar yok. Bölüm 5: `ssl_protocols TLSv1.2 TLSv1.3`, AEAD şifreleri, `ssl_session_tickets off`, catch-all `ssl_reject_handshake on`, 80→443. Sertifika `certbot certonly --webroot`. Let's Encrypt OCSP'yi kapattı → stapling açma. DNS: `CAA 0 issue "letsencrypt.org"`. Doğrula: `testssl.sh` / SSL Labs. |
| 49 | **Ağ** Forwarded başlık güven zinciri: kenarda XFF'yi ez | SIK §7.12 NET-03, DVT-02 · W2 B1 · ASVS V13.4 | nginx | P0 | ⬜ | `nginx-api.conf` `X-Forwarded-For $proxy_add_x_forwarded_for` istemci XFF'sini zincire ekler. Kenar tek proxy olduğundan `proxy_set_header X-Forwarded-For $remote_addr;` + `Forwarded ""` (bölüm 5, SIK §9.3 örneği). `main.ts` `TRUST_PROXY=1` ✅ doğru (sunucu `.env`'de 1 olmalı). Test (DVT-02): sahte XFF ile rate-limit/audit IP'si değişmemeli. |
| 50 | **Ağ** API/Next yalnız loopback'te dinlesin; origin doğrudan erişime kapalı | SIK §7.12 NET-02, DVT-02 · §7.13 OPS-02 | backend, sunucu | P0 | ⬜ | `main.ts` `app.listen(port)` her arayüzde dinler. `app.listen(port, config.get('LISTEN_HOST', { infer: true }))` + Joi `LISTEN_HOST: Joi.string().default('127.0.0.1')` (dev'de cihaz testi için `.env`'de `0.0.0.0`). `ecosystem.config.js` web/admin girdilerinde (şu an `args: 'start -p 3001'` / `'start -p 3000'`) `-H 127.0.0.1` ekle: `'start -H 127.0.0.1 -p 3001'`; `web/package.json` ve `admin/package.json` `start` script'leri de aynı. ufw 4000/3000/3001/5432 kapalı (#90). Doğrula: dışarıdan `curl http://SUNUCU_IP:4000/health` zaman aşımı. |
| 51 | **Ağ** Public API yüzeyini daralt (admin, Swagger, health) | SIK §7.5 API-01, §7.13 OPS-01, ARC-04 | nginx | P1 | ⬜ | Admin/Web BFF API'ye `127.0.0.1:4000` üzerinden gider; `api.maeyja.com` yalnız mobil + iyzico callback + uploads için gerekir. nginx API bloğunda `/api/admin/`, `/api/auth/admin/`, `/api/docs` → 404; `/health` yalnız localhost/izleme IP'si; iyzico `POST /api/payments/iyzico/callback` açık kalır (bölüm 5). |
| 52 | **Ağ** CORS: tam eşleşmeli allowlist, wildcard+credentials yok | SIK §7.12 NET-05, DVT-07 · W2 §7.12 | backend | P1 | ⬜ | `main.ts` exact-match allowlist ✅ ama `CORS_ORIGINS=*` verilirse `credentials:true` ile her origin yansır; Joi prod'da `*` yasaklamıyor (#72). API cookie değil Bearer kullanır → `credentials:false`. BFF mimarisinde tarayıcı API'ye gitmez: prod'da `CORS_ORIGINS` yalnız admin/web origin'leri (mobil CORS gerektirmez). |
| 53 | **Ağ** nginx genel sertleştirme: gövde/başlık limitleri, zaman aşımı, `server_tokens`, catch-all | SIK §7.13 OPS-01, §7.17 RES-01 · W2 §7.13 | nginx | P1 | ⬜ | Şu an `client_max_body_size 20m` tüm sunucuda. Yap: varsayılan `1m`, yalnız `/api/admin/media`'da `20m`; `client_header_timeout/client_body_timeout 15s`, `keepalive_timeout 30s`, `large_client_header_buffers 4 8k`, `limit_conn`; `server_tokens off`; bilinmeyen `Host` → catch-all reddi; `location ~ /\.(?!well-known)` → 404; `sites-enabled/default` kaldır. Tümü bölüm 5'te. |
| 54 | **Hız** Uygulama katmanı rate limit (global + kritik uçlar) | SIK §7.17 RES-01 · KG T10 · W2 §7.17 · ASVS V2.4 | backend | P0 | ✅ | `ThrottlerModule` global 120/60 sn (env'den); `login/register/admin-login/reset` 8/dk, `forgot-password` & `resend` 3/dk, `checkout` & `pay` & `orders/lookup` 10/dk, `returns` 5/dk, `contact` 3/dk, newsletter 5/dk, `stock-alerts` 10/dk. Tek pm2 instance'ta bellek-içi yeterli; cluster'a geçilirse Redis storage (RES-01). |
| 55 | **Hız** nginx katmanı rate limit (`limit_req`/`limit_conn`) | SIK §7.17 RES-01 · KG T10 · W2 §7.17 | nginx | P1 | ⬜ | `limit_req_zone` api/auth/web/admin bölgeleri + `limit_conn` (bölüm 5). 429'lar `nginx-limit-req` jail'iyle fail2ban'a bağlanır (#91). CGNAT'lı mobil trafikte `auth` bölgesi `burst`'lü olsun. |
| 56 | **Hız** Next→API çağrılarında gerçek istemci IP'si / SSR kovası | SIK §7.12 NET-03, §7.17 RES-01 · KG T10 | backend, web | P1 | ⬜ | `web/lib/api.server.ts` `apiGet` yalnız `opts.auth` iken XFF iletir → anonim SSR/ISR çağrıları API'de `127.0.0.1` görünür ve **hepsi tek 120/dk kovasına** düşer (kendi kendine 429). Yap: BFF/SSR her istek bağlamlı çağrıda `X-Forwarded-For: <X-Real-IP>` ilet; API'de `class AppThrottlerGuard extends ThrottlerGuard { protected async shouldSkip(ctx){ const ip = ctx.switchToHttp().getRequest().ip; return ip==='127.0.0.1'\|\|ip==='::1'\|\|ip==='::ffff:127.0.0.1'; } }` (nginx dış trafiğe her zaman XFF eklediğinden dışarıdan taklit edilemez). |
| 57 | **Hız** Pahalı/kötüye açık uçlar ayrı bütçe | SIK §7.17 RES-01/02 · KG T10 · W2 §7.17 | backend | P2 | ⬜ | `payments/iyzico/callback` `@SkipThrottle()` → 60/dk/IP; `POST /cart/coupon` 10/dk (kupon tahmini); public `POST/DELETE /devices` 20/dk ve `userId` yalnız oturum açıkken, cihaz sahibiyse değiştirilsin (abonelik id'si başkasına bağlanamasın); `export.csv` 1/dk + audit (#67). |
| 58 | **Ağ** Origin izolasyonu: web / admin / api ayrı host, host-only cookie; admin için IP kısıtı | SIK §7.1 ARC-02, §7.9 AZ-05 · W1 §7.1 · KG T9 | nginx, admin | P1 | ⬜ | `maeyja.com` (web), `admin.maeyja.com`, `api.maeyja.com`; cookie'lerde `Domain` yok → admin oturumu web'e (ve web XSS'i admin'e) taşmaz. Opsiyonel: `snippets/mj-admin-allow.conf` ile sabit IP/WireGuard/Tailscale allowlist (bölüm 5); admin `X-Robots-Tag: noindex`. IP kısıtı MFA'nın yerine geçmez. |
| 59 | **Dosya** Yükleme yetkisi, limitler, rastgele ad, yeniden kodlama | SIK §7.6 FIL-01/02 · KG T7 · W2 §7.6 · ASVS V5 | backend | P0 | ✅ | `media.controller.ts` `@Roles(STAFF_ROLES)`, `memoryStorage` + `fileSize 15 MB` + `files:1`; `media.service.ts` 8 bayt rastgele ad + `yıl/ay` klasörü, görseller sharp ile WebP'ye **yeniden kodlanır** (EXIF/GPS silinir, polyglot etkisizleşir), `safePath` ile dizin kaçışı engelli. Not: `startsWith(this.root)` → `this.root + path.sep` ile karşılaştır (P2). |
| 60 | **Dosya** Görsel decompression-bomb / bellek koruması | SIK §7.6 FIL-03, §7.17 RES-02 · W2 §7.6 (CWE-409) | backend | P1 | ⬜ | `sharp(file.buffer, { failOn:'error' })` varsayılan `limitInputPixels` ≈ 268 MP (≈1 GB RAM) → pm2 `max_memory_restart 400M` ile DoS. Yap: `sharp(file.buffer, { failOn:'error', limitInputPixels: 40_000_000 })`; `main.ts`'te `sharp.cache(false); sharp.concurrency(1)`; rendition döngüsü seri (zaten). |
| 61 | **Dosya** Video yüklemede içerik imzası (magic byte) doğrulaması | SIK §7.6 FIL-01 · KG T7 · W2 §7.6 | backend | P1 | ⬜ | Video için yalnız istemcinin `Content-Type`'ı (`file.mimetype`) kontrol ediliyor; her bayt dizisi `.mp4/.webm` olarak saklanır. Yap: mp4 → `buf.subarray(4,8).toString('ascii')==='ftyp'`; webm → `buf.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))`; uzantı ve bildirilen MIME ile birlikte; video için ayrı boyut limiti; ffprobe doğrulaması P2. |
| 62 | **Dosya** Upload sunumu: ad deseni allowlist, nosniff, sandbox CSP; Express fallback prod'da kapalı | SIK §7.6 FIL-02/04 · KG T7 ("Content-Disposition + güvenli Content-Type") · W2 §7.6 | nginx, backend | P1 | ⬜ | Bölüm 5 `/uploads/` regex'i yalnız `YYYY/MM/<16 hex>(-<w>).webp\|mp4\|webm`; kalan her şey 404; `nosniff` + `Content-Security-Policy: default-src 'none'; sandbox`; `disable_symlinks on`. nginx `add_header` miras tuzağı: location içinde `add_header` varsa server seviyesindekiler düşer → snippet'i yeniden `include` et. `main.ts` `useStaticAssets('/uploads')` yalnız `!isProd`. `UPLOAD_DIR` repo dışına (`/var/lib/maeyja/uploads`, sahibi deploy, 755) ve yedeğe dahil (P2). |
| 63 | **Dosya** Müşteri dosya yüklemesi (iade fotoğrafı vb.) | SIK §7.6 FIL-01…05 · W2 §7.6 | backend | P2 | ➖ | Şu an müşteri yüklemesi yok (yalnız staff `admin/media`). Eklenirse FIL-01…05'in tamamı (karantina, AV/sandbox, fail-closed, indirme yetkisi) devreye girer; ClamAV (`clamd`) o zaman zorunlu. |
| 64 | **Hata/Log** Jenerik hata yanıtı, stack yalnız sunucu logunda | SIK §7.15 LOG-02, §7.13 OPS-01 · W2 §7.15 · ASVS V16 | backend | P0 | ✅ | `http-exception.filter.ts`: 5xx → `Beklenmeyen bir hata oluştu`, stack `logger.error`. Açık (P2): Prisma hatasında `details:{code,target}` (kolon/index adı) ve `Veritabanı hatası (P2xxx)` istemciye gidiyor; `path: req.originalUrl` query'deki token'ı yansıtır → prod'da `details` kaldır, `path`'ten query'yi at. |
| 65 | **Hata/Log** İstek korelasyon kimliği + yapılandırılmış log + redaksiyon | SIK §7.15 LOG-01/02 · W2 §7.15 · ASVS V16 | backend, nginx | P1 | ⬜ | nginx `X-Request-Id $request_id` (bölüm 5) → API middleware `req.id` → log satırı, hata gövdesi, `AuditLog`. `nestjs-pino` (JSON) ile `redact: ['req.headers.authorization','req.headers.cookie','*.password','*.token','*.refreshToken','*.iban']`. `mail.service` log'larında alıcı adresi yerine hash/kısaltma. |
| 66 | **Hata/Log** Admin yazma işlemleri denetim kaydı | SIK §7.15 LOG-01 · W2 §7.15 | backend | P1 | ✅ | `audit-log.interceptor.ts`: `/admin/` altındaki başarılı POST/PATCH/PUT/DELETE → `AuditLog` (actor, action, entity, ip, `meta` gövde; `password/token/secret/apiKey` anahtarları `***`). Not: redaksiyon yalnız üst seviye anahtarlar → özyinelemeli yap. `req.ip` `TRUST_PROXY` ile gerçek IP. |
| 67 | **Hata/Log** Güvenlik olayları ve export'lar kayıt altında olsun | SIK §7.15 LOG-01/04 · KG T12 · W2 §7.15 | backend | P1 | ⬜ | Interceptor yalnız admin yazmalarını kaydeder. Eksik: giriş başarı/başarısızlığı, refresh-reuse (şu an yalnız `logger.warn`), parola değişimi/sıfırlama, MFA olayları, 403'ler, **GET export'lar** (`orders/export.csv`, `newsletter/export.csv`). Yap: `AuthEvent` modeli (userId?, emailHash, type, ip, ua, requestId, createdAt) + `SecurityEventsService.log()`; export uçlarında `@Audit('export')`. `AuditLog` için runtime role'den UPDATE/DELETE hakkı al (bölüm 4 SQL). |
| 68 | **Hata/Log** Kart verisi sistemimize girmiyor; ödeme kaydı minimum | SIK §7.14 DAT-01, §7.15 LOG-02 · KG T12 · W2 §7.14 | backend | P0 | ✅ | iyzico Checkout Form (hosted/3DS): PAN/CVV API'ye gelmez; DB'de yalnız `cardLast4`, `cardAssociation`, `installment` (PCI kapsamı SAQ-A düzeyi). Açık (P2): `Payment.raw` iyzico yanıtının tamamını saklıyor → allowlist (`paymentId, paymentStatus, fraudStatus, price, paidPrice, currency, basketId, lastFourDigits, cardAssociation`); `binNumber`/`cardToken` saklama. |
| 69 | **Hata/Log** Log rotasyonu, saat senkronu, bütünlük/saklama | SIK §7.15 LOG-03 · KG T12 · W2 §7.15 | sunucu | P1 | ⬜ | `ecosystem.config.js` `/var/log/pm2/*.log` döndürülmüyor → `pm2 install pm2-logrotate` (20M, 14 gün, sıkıştır); nginx logrotate 14 gün; saat: `timedatectl set-ntp true`; `AuditLog` yalnız-ekle (#67) + aylık dışa aktarım. Saklama süresini #103'e bağla (IP içeren loglar KVKK kapsamında). |
| 70 | **Hata/Log** Alarm kuralları + uptime/sağlık izleme | SIK §7.15 LOG-04/05, §6 (alarm ≤5 dk) · KG T12 · W1 §1.1 | backend, süreç | P1 | ⬜ | Alarm: refresh-reuse, aynı hesapta ≥10 başarısız giriş/10 dk, yeni IP'den admin girişi, MFA kapatma, rol değişimi, export, 5xx oranı, `needs_refund` logu (`checkout.service.ts`). Minimum araç seti: Sentry (Nest+Next, PII scrub) + 5 dk'lık cron ile `AuthEvent` sorgusu → e-posta/Telegram; Better Stack/UptimeRobot `GET /health` (1 dk), pm2 restart ve disk %80 alarmı. `/health` public'te `uptimeSec/dbLatencyMs` sızdırıyor → dışarıya yalnız `{status:'ok'}` (ayrıntı iç `/health/details`). |
| 71 | **Sır** Env tek kaynak (Joi) ve prod'da fail-closed başlangıç | SIK §7.11 KEY-01 · W1 B4 · W2 §7.13 · ASVS V13.3 | backend | P0 | ✅ | `env.validation.ts`: tüm env değişkenleri şemada, prod'da `API_URL/WEB_URL/ADMIN_URL/IYZICO_BASE_URL` https + örnek JWT sırrı yasak. `SWAGGER_ENABLED` varsayılan false ve `main.ts` prod'da yalnız bununla açar. |
| 72 | **Sır** Joi prod kuralları eksikleri tamamla | SIK §7.11 KEY-01, §7.13 OPS-01 · W2 §7.13 | backend | P0 | ⬜ | `.when(production)` bloğuna: `UPLOAD_PUBLIC_URL` https, `CORS_ORIGINS` içinde `*` yok (`Joi.string().pattern(/^(?!.*\*)/)`), `SWAGGER_ENABLED` `valid(false)`, `SEED_ADMIN_PASSWORD` `min(15).invalid('ChangeMe!2026')`, `LISTEN_HOST`, `MFA_ENC_KEY` (varsa). iyzico: sandbox testi bitince `IYZICO_BASE_URL` `valid('https://api.iyzipay.com')` ve `IYZICO_API_KEY/SECRET_KEY` boş olamaz. |
| 73 | **Sır** `.env.example` tehlikeli varsayılanları + seed güvenliği | SIK §7.13 OPS-01, §7.11 KEY-01 · W2 §7.13 | backend, süreç | P0 | ⬜ | `.env.example`: `SWAGGER_ENABLED=true`, `SEED_ADMIN_EMAIL=admin@maeyja.com`, `SEED_ADMIN_PASSWORD=ChangeMe!2026`; SERVER-SETUP `cp .env.example .env` der, `deploy.sh` `npm run db:seed` çağırır → hesap yoksa bilinen parolayla SUPER_ADMIN oluşur. Yap: örnekte `SWAGGER_ENABLED=false`, `SEED_ADMIN_PASSWORD=` boş; `seed.ts` prod'da parola boş/<15/`ChangeMe` ise **çık**; ilk girişten sonra iki satırı `.env`'den sil; `deploy.sh`'tan `db:seed`'i çıkar (yalnız `--first-run`). İsimli staff hesapları aç, ortak `admin@` kullanma. |
| 74 | **Sır** 3. taraf sırlar yalnız sunucuda; tarayıcıya çıkmaz | SIK §7.11 KEY-02 · W2 §7.11 · ASVS V13.3 | backend, web, admin | P0 | ✅ | `IYZICO_*`, `ONESIGNAL_API_KEY`, `SMTP_PASS` yalnız API env'inde; web/admin `API_URL` server-only, `NEXT_PUBLIC_` altında sır yok (`.env.example` dosyaları doğrulandı); `.gitignore` `.env`, `.env.*` (+`!.env.example`), `.env*.local`; `ecosystem.config.js` sır içermez. `productionBrowserSourceMaps` varsayılanı (kapalı) korunsun. |
| 75 | **Sır** `.env` dosya izni; pm2 env sızıntısı | SIK §7.11 KEY-02, §7.13 OPS-02 | sunucu | P1 | ⬜ | `chown deploy:deploy backend/.env && chmod 600`; `pm2 --update-env` kabuk ortamını `~/.pm2/dump.pm2`'ye yazar → kabukta sır export etme, `chmod 600 ~/.pm2/dump.pm2`; hata ayıklama çıktılarında `.env` paylaşma. |
| 76 | **Sır** Sır taraması (git geçmişi dahil) | KG T11 · SIK §7.13 OPS-05, RAP-12 · W2 §7.11 · ASVS V13.3 | süreç | P0 | ⬜ | Repo GitHub'da: `gitleaks detect --source . --log-opts="--all" --redact` bugün çalıştır; bulgu varsa o sırrı **döndür** (geçmişi temizlemek yetmez). Sonra pre-commit (`gitleaks protect --staged`) + CI adımı. Web/admin bundle'ında da tara (`gitleaks dir .next/static`). |
| 77 | **Sır** Rotasyon ve acil iptal prosedürü | SIK §7.11 KEY-03 · KG R3, T11 · DVT-11 | süreç | P1 | ⬜ | Sıra: `JWT_ACCESS_SECRET` (restart) → DB parolaları → `IYZICO_*` → SMTP → `ONESIGNAL_API_KEY` → SSH/deploy anahtarları; ardından `UPDATE "RefreshToken" SET "revokedAt"=now() WHERE "revokedAt" IS NULL;`. Anahtar envanteri (amaç, sahip, son rotasyon) tablosu; 6 ayda bir planlı rotasyon tatbikatı. |
| 78 | **Sır** Alan düzeyi şifreleme (TCKN, TOTP sırrı) ve yedek/disk şifreleme | SIK §7.11 KEY-04, §7.14 DAT-02 · W2 §7.11, §7.14 | backend, sunucu | P1 | ⬜ | `Order.billingAddress.identityNumber` düz JSON'da: AES-256-GCM (`FIELD_ENC_KEY`, `v1:` sürüm öneki) ya da iyzico'ya iletip saklamama. TOTP sırrı aynı yolla (#6). VPS disk/snapshot şifrelemesini sağlayıcı panelinden teyit et (uzak VPS'te LUKS boot parolası pratik değil); yedekler `age` ile şifreli (#86). |
| 79 | **Bağımlılık** Lockfile + `npm ci` | SIK §7.13 OPS-04 · KG T11 · ASVS V15 | backend, web, admin | P0 | ✅ | `package-lock.json` üç projede var; `deploy.sh` `npm ci` kullanır (lockfile dışına çıkmaz). |
| 80 | **Bağımlılık** `npm audit` bulgularını kapat, kapıya bağla | SIK §7.13 OPS-05, RAP-12 · KG T11 · W2 §7.13 | backend | P0 | ⬜ | `npm audit --omit=dev` (28.10.2026): 7 bulgu / 5 high. Asıl: `@nestjs/platform-express` içindeki `multer@2.4.0` (DoS, GHSA-q7qp-rjg7-q26m; üst düzey `multer@2.5.0` var ama nested kopya eski) → `package.json` `"overrides": { "multer": "2.5.0" }` ya da platform-express güncelle. `deepmerge-ts` (Prisma CLI üzerinden, derleme zamanı) ve `js-yaml` (swagger, kullanıcı YAML'ı işlenmiyor) → gerekçeyi yazıp kabul et veya güncelle. Web/admin için de çalıştır. CI: `npm audit --omit=dev --audit-level=high`. |
| 81 | **Bağımlılık** CI kapısı, Dependabot/Renovate, CodeQL, SBOM | SIK §7.13 OPS-04/05 · KG T11 · W2 §7.13, §10.1 | süreç | P1 | ⬜ | GitHub Actions: `npm ci`, `tsc --noEmit`, `jest`, `npm audit`, gitleaks, CodeQL (JS/TS). Dependabot haftalık (gruplar: nest, prisma, next/react). `npx @cyclonedx/cyclonedx-npm --omit dev --output-file sbom.json` artefakt olarak sakla (P2). Next/React güvenlik bültenlerini izle (RSC/App Router'da geçmişte kritik RCE yaşandı) → Next'i güncel yama sürümünde tut. |
| 82 | **Bağımlılık** Desteklenen Node sürümü (Node 20 EOL) | SIK §7.13 (yama SLA'sı) · W2 §7.13 · SIK OPS-04 | sunucu, süreç | P0 | ⬜ | Backend README/`engines` "Node 20", SERVER-SETUP `setup_20.x`; Node 20 Nisan 2026'da EOL (nodejs.org sürüm takviminden teyit et). Node 24 LTS'e geç: NodeSource apt deposunu anahtarla elle ekle (bölüm 4), `engines` `>=24`, CI matrix, `curl \| bash` yok. Prisma 6 / Nest 11 / Next 16 bu sürümleri destekler; önce staging'de `npm ci && npm test`. |
| 83 | **Bağımlılık** `deploy.sh` yeniden-üretilebilir ve dev bağımlılıkla uyumlu olsun | SIK §7.13 OPS-04 · KG T11 (build artefakt bütünlüğü) | süreç | P1 | ⬜ | `npm ci --omit=dev` sonrası `npx prisma generate/migrate deploy`, `nest build` ve `ts-node` (db:seed) **devDependency** ister → ya başarısız olur ya `npx` kayıt defterinden sürümsüz indirir (tedarik zinciri + sürüm kayması). Kontrol et; çözüm: `npm ci` (dev dahil) → build/migrate → `npm prune --omit=dev`; `npx --no-install`; `prisma` ve `ts-node` pinli. |
| 84 | **Veritabanı** PostgreSQL yalnız localhost; `scram-sha-256`; parola komut satırında değil | SIK §7.12 NET-02/04, §7.13 OPS-02 | sunucu | P0 | ⬜ | Doğrula: `SHOW listen_addresses;` = `localhost`, `pg_hba.conf` yalnız `127.0.0.1/32` + `::1/128` `scram-sha-256`, ufw 5432 kapalı. SERVER-SETUP'taki `CREATE USER … PASSWORD '<şifre>'` komutu shell geçmişine/Postgres loguna düşer → `\password` kullan (bölüm 4). |
| 85 | **Veritabanı** Runtime ve migrasyon rolleri ayrı (en az yetki) + güvenli migrasyon | SIK §7.14 DAT-04, §7.1 ARC-04 · W2 §7.14 · ASVS V13 | sunucu, backend | P1 | ⬜ | Şu an tek `maeyja` kullanıcısı hem sahibi hem runtime. `maeyja_owner` (migrate) + `maeyja_app` (SELECT/INSERT/UPDATE/DELETE + sequence; DDL yok); `schema.prisma` `datasource` → `directUrl = env("DIRECT_URL")`; `DIRECT_URL` runtime `.env`'de değil, deploy sırasında ayrı dosyadan (OS kullanıcısı aynıysa kazanç SQL-injection senaryosuyla sınırlıdır). `statement_timeout`, `AuditLog` yalnız-ekle (bölüm 4). `migrate dev/reset` prod'da yok; `deploy.sh` migrasyon öncesi `pg_dump` alsın. |
| 86 | **Veritabanı** Şifreli, harici kopyalı, otomatik yedek | SIK §7.14 DAT-05 · W2 §7.13 · KG §6 Faz 4 | sunucu | P0 | ⬜ | SERVER-SETUP: günlük `pg_dump \| gzip` + uploads `tar` aynı disk, şifresiz, saklama/alarm yok. Yap (bölüm 4 betiği): `umask 077`, `age` ile şifrele (özel anahtar sunucuda **değil**), `rclone` ile harici nesne depolamaya (yalnız-yazma anahtarı), 14 günlük + 8 haftalık saklama, başarıda `healthchecks.io` ping'i (başarısızlıkta alarm). RPO 24 sa / RTO 4 sa hedefini yaz. |
| 87 | **Veritabanı** Restore tatbikatı; silme/iptal kayıtları restore sonrası yeniden uygulansın | SIK §7.14 DAT-05, DVT-12 · W2 §7.14 | süreç | P2 | ⬜ | Ayda bir izole `maeyja_restore_test` DB'sine geri yükle, sipariş sayısı/son kayıt zamanını doğrula. `deleteAccount` anonimleştirmeleri ve iptal edilen refresh token'lar için `ErasureLog` (userId, at) tut → restore runbook'u bunları yeniden uygular; restore sonrası `RefreshToken` toptan iptal. |
| 88 | **Sunucu** Uygulama root dışı kullanıcıyla çalışsın (pm2 `deploy`) | SIK §7.13 OPS-02/03, §7.1 ARC-04 | sunucu | P0 | ⬜ | SERVER-SETUP kullanıcı oluşturmuyor (komutlar root ile). `deploy` (SSH + pm2 + `/var/www/maeyja`, sudo yok) ve sudo'lu yönetici hesabı ayrı; `pm2 startup systemd -u deploy --hp /home/deploy`; `~/.ssh/config` `User deploy`. Geçiş adımları bölüm 4. |
| 89 | **Sunucu** SSH: yalnız anahtar, root yok, `AllowUsers` | SIK §7.13 OPS-02 · W2 §7.13 | sunucu | P0 | ⬜ | `/etc/ssh/sshd_config.d/00-hardening.conf` (bölüm 4). `00-` öneki önemli: sshd ilk değeri kazanır, cloud-init `50-cloud-init.conf` parolayı açabilir. Kilitlenmemek için `sshd -t` + ikinci oturumdan test + mevcut oturumu kapatma. |
| 90 | **Sunucu** ufw: yalnız 22/80/443 | SIK §7.12 NET-02/04 | sunucu | P0 | ⬜ | `default deny incoming`, `limit 22/tcp`, `80`, `443` (bölüm 4). 3000/3001/4000/5432 dışarıya kapalı kalır; Docker olmadığından ufw atlanmaz. |
| 91 | **Sunucu** fail2ban (sshd, nginx-limit-req, recidive) | SIK §7.17 RES-01, §7.12 NET-04 · KG T10 | sunucu | P1 | ⬜ | `jail.d/maeyja.local` (bölüm 4). Kenarda CDN olmadığından nginx'in `$remote_addr`'ı gerçek IP; ileride Cloudflare vb. eklenirse `realip` modülü ve güvenilir aralıklar gerekir. `ignoreip`'e kendi sabit IP'n. |
| 92 | **Sunucu** Otomatik güvenlik yamaları (unattended-upgrades) | SIK §7.13 · W2 §7.13 ("yama SLA'sı") | sunucu | P0 | ⬜ | Bölüm 4: güvenlik deposu otomatik, `Automatic-Reboot 04:30` (yedek 03:00'ten sonra; `pm2 startup`, nginx, postgresql systemd ile geri döner). NodeSource/Node yamaları ayda bir elle `apt upgrade nodejs` + pm2 reload. Kernel için `needrestart`. |
| 93 | **Sunucu** sysctl sertleştirme, saat, dosya izinleri | SIK §7.13 OPS-02, §7.15 LOG-03 | sunucu | P2 | ⬜ | Bölüm 4 `99-maeyja-hardening.conf` (rp_filter, redirect/source-route kapalı, syncookies, kptr/dmesg kısıtı, protected_symlinks…), `timedatectl set-ntp true`, `.env` 600, yedek dizini 700, `/var/www/maeyja` 755 (nginx uploads'a erişsin). |
| 94 | **Sunucu** pm2/systemd sınırları, egress, servis envanteri | SIK §7.13 OPS-03, §7.12 NET-04, §7.16 EXT-02, §7.1 ARC-01 | sunucu | P2 | ⬜ | `ecosystem.config.js`: `max_memory_restart` ✅ ve `exec_mode:'fork'` ✅ zaten var; ekle: `node_args:'--max-old-space-size=384'`, `kill_timeout`, `max_restarts`, web/admin girdileri (`-H 127.0.0.1`); `pm2-deploy.service` drop-in: `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectSystem=full`. Opsiyonel egress: ufw `default deny outgoing` + 53/80/443/587/123. `ss -tulpn` ile dışarıya yalnız 22/80/443; `lynis audit system` aylık. |
| 95 | **Ödeme** iyzico callback sunucu doğrulaması + tekrar oynatma koruması | SIK §7.16 EXT-04 · KG T6 · W2 §7.3 · ASVS V2.3 | backend | P0 | ✅ | `checkout.service.handleIyzicoCallback`: tarayıcı `token`'ına güvenmeden `retrieveCheckoutForm` (sunucudan sunucuya, IYZWSv2 HMAC imzalı istek) + `verify()`: `paymentStatus`, `fraudStatus`, `conversationId`, `basketId`, `currency`, `price/paidPrice` kontrolü; `providerToken @unique`; `updateMany(PENDING\|FAILED→SUCCEEDED)` idempotent; tekrar gelen callback aynı sonucu döndürür. Başarısız/bilinmeyen token → `status=failed` yönlendirmesi. |
| 96 | **Ödeme** Fiyat/stok/kupon otoritesi sunucuda; durum makinesi | SIK §7.3 BUS-01/02 · KG T6 · W2 §7.3 · ASVS V2.3/V15.4 | backend | P0 | ✅ | `PricingService.quote()` tek fiyat otoritesi (istemci fiyat göndermez); stok `updateMany(stock >= qty)` ve kupon `usedCount` aynı transaction'da koşullu; çift gönderimde sepet aynı transaction'da boşaldığından ikinci istek "Sepetiniz boş"; `TRANSITIONS` tablosu + `order-lifecycle.service.ts` (spec'li). İleride `Idempotency-Key` P2. |
| 97 | **Ödeme** Mutabakat: ödeme başarılı ama dönüş gelmediyse sipariş iptal edilmesin | SIK §7.16 EXT-04, §7.3 BUS-05, §7.17 RES-04 | backend | P1 | ⬜ | `orders.jobs.ts expireUnpaidOrders` 30 dk sonra `PENDING_PAYMENT` siparişi **iyzico'ya sormadan** iptal edip stoğu bırakır; müşteri 3DS sonrası sekmeyi kapatırsa para alınır, sipariş iptal olur ("geç ödeme" yalnız callback gelirse kurtarılır). Yap: iptal öncesi son `Payment`'ın `providerToken`'ı ile `retrieveCheckoutForm`; `SUCCESS` ise `PAID`'e geçir. iyzico panelinde bildirim/webhook tanımlanıyorsa `POST /payments/iyzico/webhook` (imza + zaman penceresi + olay kimliği tekilliği). |
| 98 | **Ödeme** iyzico yanıt `signature` alanı doğrulaması (derinlemesine savunma) | SIK §7.16 EXT-04 | backend | P2 | ⬜ | `retrieveCheckoutForm` yanıtındaki `signature`'ı iyzico'nun güncel dokümanındaki HMAC-SHA256 formülüyle (`IYZICO_SECRET_KEY`) doğrula (alan sırası/format dokümandan teyit edilmeli). Kanal TLS ile zaten doğrudan iyzico'ya olduğundan öncelik düşük. |
| 99 | **Ödeme** SMTP TLS zorunlu (STARTTLS downgrade yok) | SIK §7.16 EXT-05 · W2 §7.16 · ASVS V12 | backend | P1 | ⬜ | `mail.service.ts` `createTransport({ host, port, secure, auth })`: `secure:false` + 587'de STARTTLS opsiyonel → sunucu TLS sunmazsa düz metin. Ekle: `requireTLS: !secure`, `tls:{ minVersion:'TLSv1.2' }` (sertifika doğrulaması varsayılan açık kalsın). |
| 100 | **Ödeme** E-posta alan adı kimliği: SPF/DKIM/DMARC | SIK §7.7 AUT-03 (e-posta kanalı) — rehberlerde ayrıca yok, ek öneri | süreç | P1 | ⬜ | `hello@maeyja.com` adına sahte "parola sıfırla" e-postasını engeller + teslim edilebilirlik: SPF (`-all`, SMTP sağlayıcısını include et), sağlayıcının DKIM kaydı, `_dmarc` `p=none` → 2 hafta rapor → `quarantine` → `reject`, `rua=` adresi. |
| 101 | **KVKK** Yasal metinler, açık rıza kaydı, çerez | SIK §7.14 DAT-01 · W2 §7.14 + KVKK m.10/m.5 (mevzuat; rehberlerde ayrıca yok) | süreç, web, backend | P0 | ⬜ | `seed.ts` `LEGAL_PAGES` gövdeleri yer tutucu ("metni buraya gelecek"): KVKK Aydınlatma, Gizlilik/Çerez, Mesafeli Satış, Ön Bilgilendirme gerçek metinle yayınlanmadan canlıya çıkma. Checkout'ta sözleşme onayı ve pazarlama izni kaydı: `marketingConsentAt/Ip/Version`, sipariş için `termsAcceptedAt/Version`. Ticari elektronik ileti onayı/İYS yükümlülüğü ve çerez bandı (analitik eklenirse) için hukuk danışmanı teyidi. |
| 102 | **KVKK** Silme hakkı: hesap anonimleştirme | SIK §7.14 DAT-05 · W2 §7.14 · KVKK m.7 | backend | P1 | ✅ | `users.service.deleteAccount`: adres/refresh/wishlist/sepet/cihaz/bülten silinir, kullanıcı anonimleştirilir (`deleted-<id>@deleted.maeyja`, `deletedAt`), siparişler yasal saklama için kalır. Eksik: `DELETE /me` yeniden doğrulama istemiyor (çalıntı access token ile hesap silinir) → gövdede mevcut parola iste. |
| 103 | **KVKK** Saklama süresi tablosu ve temizlik işi | SIK §7.14 DAT-01/05 · W1 §7.14 · W2 §7.14 | backend, süreç | P2 | ⬜ | Mevcut: `cleanup` cron'u (04:00) eski refresh/auth token ve 30 günlük misafir sepetini siler ✅. Ekle `PrivacyJobs`: sipariş/fatura verisi yasal süre sonunda anonimleştir (süreyi muhasebeci/hukukla teyit et), `Order.ip` ve `RefreshToken.ip` 6–12 ay, `ContactMessage` 2 yıl, `AuditLog`/`AuthEvent` 2 yıl, nginx/pm2 log 14–90 gün, yedek 6 ay. Tabloyu burada/`docs/`'ta yaz, sahibini ata. |
| 104 | **KVKK** Veri ihlali bildirim süreci (72 saat) | SIK §7.15 LOG-05 · KG §6 Faz 4 + KVKK m.12/5 ve Kurul kararı (mevzuat) | süreç | P1 | ⬜ | İhlal öğrenildikten sonra en kısa sürede Kurul'a bildirim (Kurul'un ilke kararı: en geç 72 saat — güncel durumu hukuk danışmanıyla teyit et); ilgili kişilere bildirim şablonu; sorumlu kişi/telefon; VERBİS kayıt yükümlülüğü olup olmadığını kontrol et. Olay müdahale planına (#106) bağla. |
| 105 | **Süreç** Hesap güvenliği: GitHub, hosting, alan adı, iyzico, OneSignal, SMTP | KG T11 (CI/CD değişkenleri/artefakt bütünlüğü) · SIK §7.13 OPS-05 — rehberlerde ayrıca yok, ek öneri | süreç | P0 | ⬜ | `git pull` ile canlıya giden kod = GitHub hesabı sunucu anahtarı. GitHub: 2FA (passkey/TOTP), `main` branch protection (PR + force-push kapalı), commit imzası; sunucuda **salt-okunur deploy key** (kişisel token değil). Registrar/hosting/iyzico merchant paneli/OneSignal/SMTP sağlayıcısı: 2FA + kurtarma kodları çevrimdışı. Alan adı kilidi (registrar lock). |
| 106 | **Süreç** Olay müdahale runbook'u | SIK §7.15 LOG-05, §5 · KG T11 ("acil iptal") · DVT-11 | süreç | P1 | ⬜ | 1 sayfa: tespit → durdurma (`pm2 stop`, nginx `return 503`) → kanıt (log/snapshot sakla) → iptal (#77 sırası) → geri açma → KVKK (#104) → iyzico/hosting iletişimi. Yılda 1 masa başı tatbikat. |
| 107 | **Süreç** Kabul testleri (DVT-01…12) ve yayın kapısı | SIK §8, §10, §5 ("yayın kapısı") · W1 §8 | backend, süreç | P1 | ⬜ | Jest/supertest e2e: refresh-reuse + paralel (DVT-05), `/admin/*` CUSTOMER 403 (#25), reset token paralel tüketim (DVT-06), CSRF origin reddi (DVT-07), upload bomb/polyglot (DVT-09), iyzico tekrar/tutar uyuşmazlığı, XFF sahteciliği (DVT-02), IDOR (DVT-03). `make security-check` (audit + gitleaks + typecheck + test) `make ship` öncesi zorunlu. |
| 108 | **Süreç** Kanıt paketi ve tehdit modeli | SIK §10, §3, ARC-01/03 · KG §4 · W2 §12 | süreç | P2 | ⬜ | Her P0 kapatmada: commit SHA, tarih, ortam, test adımı, maskeli çıktı, kalan risk (SIK §10 şablonu); "Geçti" yalnız kanıtla. Servis envanteri (nginx, web, admin, api, postgres, iyzico, OneSignal, SMTP, mobil), güven sınırları ve veri sınıfları 1 sayfa; büyük mimari değişimde ve yılda 1 yenile. |
| 109 | **Süreç** Mobil (Expo, ileride) uygulama güvenliği | W2 §7.14 (istemci depolama) · SIK §7.8 SES-01, §7.10 TOK-05 — mobil rehberlerde ayrı ele alınmıyor | süreç | P2 | ⬜ | Token'lar `expo-secure-store` (Keychain/Keystore), `AsyncStorage`'a asla; BFF olmadığı için `POST /auth/refresh` tek-uçuş kilidi (#19); iyzico `paymentPageUrl` WebView `originWhitelist` kısıtlı; deep link `maeyja://order/:no` oturum + sahiplik doğrular; (P2) sertifika pinning. |

## 3. P0 — hemen (15 madde)

Her madde tablodaki ⬜ P0 satırlarına bağlıdır; sırası "az emekle çok risk kapatan" önceliklidir. Yayın kapısı: bunların tümü kapanmadan canlıya normal yayın onayı yok (SIK §5).

**1. Ağ yüzeyini kapat** (tablo #50, #90, #84) — `backend/src/main.ts` ve `config/env.validation.ts`:
```ts
// env.validation.ts → Joi: LISTEN_HOST: Joi.string().default('127.0.0.1')   (Env arayüzüne de ekle)
// main.ts
await app.listen(port, config.get('LISTEN_HOST', { infer: true }));
```
`ecosystem.config.js` web/admin: `args: 'start -H 127.0.0.1 -p 3001'` / `-p 3000`. Sunucuda ufw (bölüm 4): yalnız 22/80/443. PostgreSQL `listen_addresses='localhost'`. Doğrula: dışarıdan `curl -m5 http://SUNUCU_IP:4000/health` zaman aşımına düşmeli.

**2. nginx: TLS + HSTS + XFF ezme** (#47, #48, #49) — bölüm 5'teki yapıyı kur; kritik üç satır: `proxy_set_header X-Forwarded-For $remote_addr;`, `ssl_protocols TLSv1.2 TLSv1.3;`, `Strict-Transport-Security max-age=300` (sonra kademeli artır). Sertifika: `certbot certonly --webroot -w /var/www/certbot -d maeyja.com -d www.maeyja.com -d admin.maeyja.com -d api.maeyja.com --deploy-hook "systemctl reload nginx"`.

**3. Prod `.env` tehlikeli varsayılanlar** (#72, #73) — `backend/.env.example`: `SWAGGER_ENABLED=false`, `SEED_ADMIN_PASSWORD=` boş. `prisma/seed.ts` `main()` içinde `email/password` okunduktan hemen sonra:
```ts
if (process.env.NODE_ENV === 'production' && email && (!password || password.length < 15 || /changeme/i.test(password)))
  throw new Error('SEED_ADMIN_PASSWORD prod için güçlü olmalı (>=15, örnek değer değil)');
```
Sunucuda ilk girişten sonra `SEED_ADMIN_*` satırlarını sil, `deploy.sh`'tan `db:seed`'i çıkar. Joi prod bloğuna `CORS_ORIGINS` (`*` yok), `UPLOAD_PUBLIC_URL` https, `SWAGGER_ENABLED=false` ekle (#72).

**4. Hesap bazlı brute-force / backoff** (#5) — `prisma/schema.prisma` `User`: `failedLogins Int @default(0)`, `lockedUntil DateTime?` + migrasyon. `auth.service.login()`:
```ts
const locked = user?.lockedUntil && user.lockedUntil > new Date();
const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);   // zamanlama için hep çalışır
if (locked) throw new HttpException('Çok fazla deneme, lütfen daha sonra tekrar deneyin', 429);
if (!user || !ok || user.deletedAt) {
  if (user) { const n = user.failedLogins + 1;
    await this.prisma.user.update({ where:{ id:user.id }, data:{ failedLogins:{ increment:1 },
      ...(n >= 5 ? { lockedUntil: new Date(Date.now() + Math.min(2 ** (n - 5), 30) * 60_000) } : {}) } }); }
  throw new UnauthorizedException('E-posta veya şifre hatalı');
}
await this.prisma.user.update({ where:{ id:user.id }, data:{ failedLogins:0, lockedUntil:null, lastLoginAt:new Date() } });
```
Var olmayan e-posta için bellek-içi LRU sayaç ekle (aynı davranış). Başarısız/kilitli olayları #67'deki `AuthEvent`'e yaz.

**5. Yönetici MFA (TOTP)** (#6, #7) — #6 satırındaki tasarım: `otplib`, `/auth/admin/login` → `mfaRequired` + 5 dk'lık `mfaToken`, `/auth/admin/login/mfa`, kullanılmış time-step reddi, 10 hash'li kurtarma kodu, `MFA_ENC_KEY` ile AES-256-GCM, `STAFF_MFA_REQUIRED=true`, CLI sıfırlama (`npm run mfa:reset`). Staff reset linki MFA'yı atlamamalı.

**6. `changePassword`: oturum iptali + throttle** (#12) — `auth.service.ts`:
```ts
await this.prisma.$transaction([
  this.prisma.user.update({ where:{ id:userId }, data:{ passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) } }),
  this.prisma.refreshToken.updateMany({ where:{ userId, revokedAt:null }, data:{ revokedAt:new Date() } }),
]);
return this.issueSession(user, meta);          // yeni oturum; BFF cookie'yi yeniler
```
`auth.controller.ts` `change-password` üstüne `@Throttle(STRICT)`; `ClientMeta` parametresi ekle.

**7. BFF allowlist (açık proxy + token sızıntısı)** (#39) — `web/app/api/[...path]/route.ts` (admin'de ters liste) `handler` başında:
```ts
const ALLOW: [RegExp, string[]][] = [
  [/^auth\/(login|register|logout|forgot-password|reset-password|verify-email|resend-verification|me|change-password)$/, ['GET', 'POST']],
  [/^(catalog|content|settings\/public|cart|checkout|orders|me|newsletter|contact)(\/[\w.-]+)*$/, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']],
];
const bad = path.some((s) => s === '' || s === '.' || s === '..' || /[\\%]/.test(s));
if (bad || !ALLOW.some(([re, m]) => re.test(target) && m.includes(req.method)))
  return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
```
`admin/*` ve `auth/admin/login` bu listeye girmediği için 404 olur. Token döndüren her rota `AUTH_ROUTES` (token sıyırma) kümesinde olmalı. `forward()`'da başlıklar allowlist'e çevrilsin (#41).

**8. BFF CSRF** (#40) — aynı `route.ts`, `handler` başında:
```ts
const SITE = new URL(process.env.NEXT_PUBLIC_SITE_URL!).origin;
function sameOrigin(req: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const origin = req.headers.get('origin'), site = req.headers.get('sec-fetch-site');
  return (origin ? origin === SITE : site === 'same-origin') && req.headers.get('x-requested-with') === 'mj';
}
if (!sameOrigin(req)) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
```
`lib/api.client.ts` `request()` başlıklarına `'X-Requested-With': 'mj'`. Admin'de `SameSite=Strict`.

**9. XSS: CMS HTML + admin düz metin** (#34, #35) — `backend/src/modules/content/content.service.ts` (ve `content-admin.controller.ts` yazma yolları): `sanitize-html` ile `Page.body/JournalPost.body/HomeSection.body` temizle (web'deki `lib/sanitize.ts` allowlist'ini paylaş; `http:` ve rastgele `img src` kaldır), DTO `@MaxLength(200000)`. Admin: `dangerouslySetInnerHTML` yasak (`eslint react/no-danger: error`); `message/customerNote/reason` düz metin.

**10. Admin CSP nonce** (#45) — `admin/proxy.ts` oluştur: `web/proxy.ts`'teki `csp(nonce)` desenini kopyala (`frame-src`/`img-src http:` çıkar), `admin/next.config.ts`'ten statik CSP'yi sil; `images.remotePatterns` → yalnız `api.maeyja.com`. İlk gün `Content-Security-Policy-Report-Only` ile doğrula.

**11. root dışı kullanıcı + SSH + otomatik yama** (#88, #89, #92) — bölüm 4 §1, §2, §5. Sırayı bozma: önce anahtarları kopyala, ikinci oturumdan `ssh deploy@…` ve `ssh emre@…` dene, sonra `PermitRootLogin no`/`PasswordAuthentication no`.

**12. Şifreli, harici yedek** (#86) — bölüm 4 §9 betiği; `age` özel anahtarını sunucuya koyma; ilk restore denemesini aynı hafta yap (#87).

**13. Sır taraması + bağımlılıklar + Node** (#76, #80, #82):
```bash
gitleaks detect --source . --log-opts="--all" --redact          # bulgu varsa sırrı döndür
cd backend && npm pkg set overrides.multer=2.5.0 && npm install && npm audit --omit=dev
```
Sunucuda Node 24 LTS (bölüm 4 §10); `engines`, README, SERVER-SETUP, CI güncelle.

**14. Hesap güvenliği** (#105) — GitHub 2FA + `main` branch protection + salt-okunur deploy key; registrar/hosting/iyzico/OneSignal/SMTP 2FA; alan adı kilidi.

**15. KVKK metinleri ve rıza kaydı** (#101) — `seed.ts` `LEGAL_PAGES` yer tutucularını gerçek metinle değiştir (admin → Sayfalar); checkout/register'da sözleşme ve pazarlama izin kaydı (`termsAcceptedAt`, `marketingConsentAt/Ip/Version`); çerez bandı gerekiyorsa analitikten önce.

## 4. Sunucu sıkılaştırma komutları (Ubuntu 22.04/24.04, `root` veya `sudo`)

> Sırayı koru. SSH'ı değiştirirken **mevcut oturumu açık tut**, yeni oturumdan test et. `<...>` yer tutucularını doldur.

**§1 — Kullanıcılar (pm2 `deploy` altında, sudo yok)**
```bash
adduser --disabled-password --gecos "" deploy
adduser --gecos "" emre && usermod -aG sudo emre          # sudo'lu yönetici (parola belirle)
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -d -m 700 -o emre   -g emre   /home/emre/.ssh
# Yerelden: ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy@<SUNUCU> ; ssh-copy-id -i ~/.ssh/id_ed25519.pub emre@<SUNUCU>
# Mevcut root pm2 kurulumunu taşı:
#   pm2 kill ; pm2 unstartup systemd
chown -R deploy:deploy /var/www/maeyja /var/log/pm2
chmod 600 /var/www/maeyja/backend/.env
# deploy olarak:  cd /var/www/maeyja && pm2 start ecosystem.config.js && pm2 save
pm2 startup systemd -u deploy --hp /home/deploy             # çıktıdaki komutu root olarak çalıştır
# Yerel ~/.ssh/config  →  Host hazal / User deploy   (Makefile SSH_HOST=hazal)
```

**§2 — SSH**
```bash
cat >/etc/ssh/sshd_config.d/00-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
AllowUsers deploy emre
MaxAuthTries 3
MaxSessions 4
LoginGraceTime 20
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitEmptyPasswords no
PermitUserEnvironment no
LogLevel VERBOSE
Match User emre
    AllowTcpForwarding local
EOF
sshd -t && systemctl reload ssh
sshd -T | grep -Ei 'permitrootlogin|passwordauthentication|allowusers|authenticationmethods'
```

**§3 — ufw**
```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp comment 'ssh'
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose
```

**§4 — fail2ban**
```bash
apt install -y fail2ban
cat >/etc/fail2ban/jail.d/maeyja.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
bantime.increment = true
bantime.maxtime   = 1w
ignoreip = 127.0.0.1/8 ::1 <KENDI_SABIT_IP>

[sshd]
enabled  = true
backend  = systemd
maxretry = 4

[nginx-limit-req]
enabled  = true
backend  = auto
port     = http,https
logpath  = /var/log/nginx/*error.log
maxretry = 10

[recidive]
enabled  = true
backend  = auto
logpath  = /var/log/fail2ban.log
bantime  = 1w
findtime = 1d
maxretry = 3
EOF
systemctl enable --now fail2ban && fail2ban-client status
```

**§5 — Otomatik güvenlik yamaları**
```bash
apt install -y unattended-upgrades apt-listchanges needrestart
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat >/etc/apt/apt.conf.d/52maeyja-unattended <<'EOF'
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
// Mail için bir MTA (msmtp/mailx) gerekir; yoksa aşağıdaki iki satırı sil
Unattended-Upgrade::Mail "<YONETICI_EPOSTA>";
Unattended-Upgrade::MailReport "on-change";
EOF
unattended-upgrade --dry-run -d 2>&1 | tail -5
```

**§6 — sysctl + saat**
```bash
cat >/etc/sysctl.d/99-maeyja-hardening.conf <<'EOF'
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_rfc1337 = 1
net.ipv4.conf.all.log_martians = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.unprivileged_bpf_disabled = 1
net.core.bpf_jit_harden = 2
kernel.yama.ptrace_scope = 1
kernel.randomize_va_space = 2
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.protected_fifos = 2
fs.protected_regular = 2
fs.suid_dumpable = 0
EOF
sysctl --system >/dev/null && echo "sysctl ok"
timedatectl set-ntp true && timedatectl status | grep -E 'System clock synchronized|NTP service'
```

**§7 — PostgreSQL: yalnız localhost + roller (parolaları `\password` ile gir)**
```bash
sudo -u postgres psql -c "SHOW listen_addresses;" -c "SHOW password_encryption;"       # localhost / scram-sha-256
grep -Ev '^\s*(#|$)' /etc/postgresql/*/main/pg_hba.conf                                 # yalnız 127.0.0.1/::1 + scram-sha-256

sudo -u postgres psql <<'SQL'
CREATE ROLE maeyja_owner LOGIN;
CREATE ROLE maeyja_app   LOGIN;
\password maeyja_owner
\password maeyja_app
ALTER DATABASE maeyja OWNER TO maeyja_owner;
\c maeyja
REASSIGN OWNED BY maeyja TO maeyja_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO maeyja_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO maeyja_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO maeyja_app;
ALTER DEFAULT PRIVILEGES FOR ROLE maeyja_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO maeyja_app;
ALTER DEFAULT PRIVILEGES FOR ROLE maeyja_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO maeyja_app;
ALTER ROLE maeyja_app SET statement_timeout = '10s';
ALTER ROLE maeyja_app SET idle_in_transaction_session_timeout = '30s';
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM maeyja_app;   -- yalnız-ekle (saklama temizliği owner ile çalışsın)
-- Aşağıdaki satırı backend/.env güncellenip uygulama yeniden başlatıldıktan SONRA çalıştır:
-- ALTER ROLE maeyja NOLOGIN;
SQL
# backend/.env:  DATABASE_URL=postgresql://maeyja_app:...@127.0.0.1:5432/maeyja?schema=public&connection_limit=10
# deploy sırasında (runtime .env dışında, chmod 600 dosyada):  DIRECT_URL=postgresql://maeyja_owner:...@127.0.0.1:5432/maeyja?schema=public
# schema.prisma → datasource db { provider="postgresql" url=env("DATABASE_URL") directUrl=env("DIRECT_URL") }
```

**§8 — pm2 log döndürme ve izinler**
```bash
sudo -u deploy -H bash -lc 'pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 20M && pm2 set pm2-logrotate:retain 14 && pm2 set pm2-logrotate:compress true'
chmod 600 /var/www/maeyja/backend/.env && chmod 755 /var/www/maeyja
install -d -m 700 -o deploy -g deploy /var/backups/maeyja /home/deploy/bin
```

**§9 — Şifreli, harici yedek (`age` + `rclone`; özel anahtar sunucuda değil)**
```bash
apt install -y age rclone
# Yerelde: age-keygen -o ~/maeyja-backup.key  → yalnız "public key" satırını sunucuya koy, özel anahtarı çevrimdışı sakla
echo "<age1_PUBLIC_KEY>" > /home/deploy/.backup-age-recipient
# deploy: ~/.pgpass (600)  →  127.0.0.1:5432:maeyja:maeyja_owner:<parola>
# deploy: rclone config  → "offsite" (yalnız-yazma anahtarlı S3/B2/Hetzner Storage Box)
cat >/home/deploy/bin/backup.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
umask 077
D=/var/backups/maeyja; TS=$(date -u +%F-%H%M); R=$(cat /home/deploy/.backup-age-recipient)
pg_dump -h 127.0.0.1 -U maeyja_owner -Fc maeyja | age -r "$R" > "$D/db-$TS.dump.age"
tar -C /var/www/maeyja/backend -cz uploads | age -r "$R" > "$D/uploads-$TS.tgz.age"
find "$D" -type f -mtime +14 -delete
rclone copy "$D" offsite:maeyja-backups --max-age 2d
curl -fsS -m 10 --retry 3 https://hc-ping.com/<HEALTHCHECKS_UUID> >/dev/null
EOF
chown deploy:deploy /home/deploy/bin/backup.sh && chmod 700 /home/deploy/bin/backup.sh
sudo -u deploy bash -c '( crontab -l 2>/dev/null; echo "0 3 * * * /home/deploy/bin/backup.sh" ) | crontab -'
# Restore denemesi (aylık, izole DB):  age -d -i ~/maeyja-backup.key db-<ts>.dump.age | pg_restore -h 127.0.0.1 -U maeyja_owner -d maeyja_restore_test --clean --if-exists
```

**§10 — Node 24 LTS (NodeSource apt deposu, `curl | bash` yok) ve doğrulamalar**
```bash
apt install -y curl gnupg ca-certificates
install -d -m 755 /usr/share/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" >/etc/apt/sources.list.d/nodesource.list
apt update && apt install -y nodejs && node -v
# deploy olarak: cd /var/www/maeyja/backend && npm ci && npm test && pm2 reload ecosystem.config.js --update-env

# --- kurulum sonrası doğrulama ---
ss -tulpn | grep -E ':(22|80|443|3000|3001|4000|5432)\b'      # 3000/3001/4000/5432 yalnız 127.0.0.1
ufw status verbose
fail2ban-client status sshd
nginx -t && curl -sI https://maeyja.com | grep -iE 'strict-transport|x-content-type|server:'
# testssl.sh --quiet --fast https://api.maeyja.com ; lynis audit system --quick
```

## 5. nginx: önerilen yapı (API + web + admin)

Repodaki `deploy/nginx-api.conf` yalnız :80 ve tek host için; aşağıdaki yapı onun yerine geçer (dosya yolları Ubuntu/Debian düzeni). Notlar: nginx ≥ 1.25.1'de `listen 443 ssl http2;` yerine `listen 443 ssl; http2 on;` yazın; `ssl_reject_handshake` ≥ 1.19.4 ister (Ubuntu 22.04'ün 1.18'inde yerine self-signed sertifikalı `return 444` kullanın). Let's Encrypt OCSP'yi sonlandırdığı için stapling yoktur. `add_header` miras kuralı: bir `location` kendi `add_header`'ını tanımlarsa server seviyesindekiler **düşer**; bu yüzden gereken yerde `include snippets/mj-headers.conf;` yeniden yazılır. Web/admin CSP'sini nginx basmaz (Next, nonce ile istek başına üretir); `proxy_hide_header` ile upstream'in çift başlıkları düşürülür. Admin BFF'sinin media yolu (`/api/admin/media`) kendi route'unuza göre güncellenmelidir.

**`/etc/nginx/conf.d/00-maeyja-http.conf`** (http seviyesi)
```nginx
server_tokens off;

# Hız sınırı bölgeleri — kenarda tek proxy biz olduğumuzdan $binary_remote_addr gerçek istemcidir
limit_req_zone  $binary_remote_addr zone=mj_api:10m   rate=20r/s;
limit_req_zone  $binary_remote_addr zone=mj_auth:10m  rate=10r/m;
limit_req_zone  $binary_remote_addr zone=mj_web:10m   rate=30r/s;
limit_req_zone  $binary_remote_addr zone=mj_admin:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=mj_conn:10m;
limit_req_status  429;
limit_conn_status 429;

# Log: $uri (query yok) → reset/verify token'ları loga yazılmaz; $request_id ile korelasyon
log_format mj '$remote_addr [$time_iso8601] $request_method $uri $status $body_bytes_sent rt=$request_time rid=$request_id ua="$http_user_agent"';
```

**`/etc/nginx/snippets/mj-ssl.conf`**
```nginx
ssl_protocols             TLSv1.2 TLSv1.3;
ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;
ssl_ecdh_curve            X25519:prime256v1:secp384r1;
ssl_session_timeout       1d;
ssl_session_cache         shared:MJSSL:10m;
ssl_session_tickets       off;
```

**`/etc/nginx/snippets/mj-headers.conf`** (ortak statik başlıklar; HSTS kademeli)
```nginx
# HSTS: önce 300 sn; sorunsuzsa 604800 → 31536000. includeSubDomains/preload yalnız tüm alt alanlar HTTPS olunca.
add_header Strict-Transport-Security "max-age=300" always;
add_header X-Content-Type-Options    "nosniff" always;
add_header X-Frame-Options           "DENY" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
```

**`/etc/nginx/snippets/mj-proxy.conf`** (istek başlıkları + upstream'in çift başlıklarını düşür)
```nginx
proxy_http_version 1.1;
proxy_set_header Connection        "";
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $remote_addr;      # istemcinin XFF'sini EZER (zincire eklemez)
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host  $host;             # Next Server Actions origin kontrolü için
proxy_set_header Forwarded         "";
proxy_set_header X-Request-Id      $request_id;
proxy_connect_timeout 5s;
proxy_send_timeout    30s;
proxy_read_timeout    30s;
proxy_hide_header X-Powered-By;
proxy_hide_header Strict-Transport-Security;
proxy_hide_header X-Content-Type-Options;
proxy_hide_header X-Frame-Options;
proxy_hide_header Cross-Origin-Opener-Policy;
proxy_hide_header Referrer-Policy;
proxy_hide_header Permissions-Policy;
```

**`/etc/nginx/snippets/mj-proxy-api.conf`**
```nginx
include snippets/mj-proxy.conf;
proxy_hide_header Content-Security-Policy;    # API için CSP'yi nginx basar
proxy_pass http://mj_api;
```

**`/etc/nginx/snippets/mj-admin-allow.conf`** (opsiyonel; sabit IP / WireGuard / Tailscale yoksa boş bırak)
```nginx
# allow 203.0.113.10;     # ofis/ev sabit IP
# allow 100.64.0.0/10;    # Tailscale
# deny  all;
```

**`/etc/nginx/sites-available/maeyja.conf`** (→ `sites-enabled/`'a symlink; `sites-enabled/default`'u sil)
```nginx
upstream mj_api   { server 127.0.0.1:4000; keepalive 16; }
upstream mj_web   { server 127.0.0.1:3001; keepalive 16; }
upstream mj_admin { server 127.0.0.1:3000; keepalive 16; }

# ───────── 80: ACME + HTTPS'e yönlendirme ─────────
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

# ───────── 443: tanımsız Host → TLS el sıkışması reddedilir ─────────
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name _;
    ssl_reject_handshake on;
}

# ───────── www → apex ─────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.maeyja.com;
    ssl_certificate     /etc/letsencrypt/live/maeyja.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/maeyja.com/privkey.pem;
    include snippets/mj-ssl.conf;
    include snippets/mj-headers.conf;
    return 301 https://maeyja.com$request_uri;
}

# ───────── API (mobil + iyzico dönüşü + uploads) ─────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.maeyja.com;

    ssl_certificate     /etc/letsencrypt/live/maeyja.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/maeyja.com/privkey.pem;
    include snippets/mj-ssl.conf;
    include snippets/mj-headers.conf;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
    add_header Content-Security-Policy "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" always;

    access_log /var/log/nginx/api.access.log mj;
    error_log  /var/log/nginx/api.error.log warn;

    client_max_body_size    1m;            # JSON API; yükleme yalnız admin BFF → API iç hattında
    client_header_timeout   15s;
    client_body_timeout     15s;
    send_timeout            30s;
    keepalive_timeout       30s;
    large_client_header_buffers 4 8k;
    limit_conn mj_conn 30;

    # Dışarıya kapalı yüzeyler (admin BFF API'ye 127.0.0.1:4000 üzerinden gider)
    location ^~ /api/admin/       { return 404; }
    location ^~ /api/auth/admin/  { return 404; }
    location ^~ /api/docs         { return 404; }
    location ~ /\.(?!well-known)  { return 404; }

    # Yüklenen medya: yalnız uygulamanın ürettiği dosya adları (media.service.ts: YYYY/MM/<16 hex>[-<genişlik>].webp|mp4|webm)
    location ~ "^/uploads/\d{4}/\d{2}/[0-9a-f]{16}(-\d{3,4})?\.(webp|mp4|webm)$" {
        root /var/www/maeyja/backend;                 # /uploads/... → /var/www/maeyja/backend/uploads/...
        disable_symlinks on;
        autoindex off;
        types { image/webp webp; video/mp4 mp4; video/webm webm; }
        default_type application/octet-stream;
        try_files $uri =404;
        # add_header miras tuzağı: location'da add_header var → ortak başlıkları yeniden ekle
        include snippets/mj-headers.conf;
        add_header Cache-Control "public, max-age=2592000, immutable" always;
        add_header Content-Security-Policy "default-src 'none'; sandbox" always;
        add_header Cross-Origin-Resource-Policy "cross-origin" always;
        add_header Access-Control-Allow-Origin "*" always;
        # Başka tür dosya servis edilecekse: add_header Content-Disposition "attachment" always;
        access_log off;
    }
    location /uploads/ { return 404; }                # deseni tutmayan her şey. DİKKAT: "^~" KULLANMA — regex aramasını durdurup yukarıdaki medya bloğunu devre dışı bırakır

    # iyzico 3DS dönüşü (tarayıcıdan cross-site form POST'u)
    location = /api/payments/iyzico/callback {
        limit_req zone=mj_api burst=20 nodelay;
        client_max_body_size 64k;
        include snippets/mj-proxy-api.conf;
    }

    # Kimlik uçları: sıkı hız sınırı
    location ~ ^/api/auth/(login|register|forgot-password|reset-password)$ {
        limit_req zone=mj_auth burst=5 nodelay;
        client_max_body_size 16k;
        include snippets/mj-proxy-api.conf;
    }

    location /api/ {
        limit_req zone=mj_api burst=40 nodelay;
        include snippets/mj-proxy-api.conf;
    }

    # Sağlık: yalnız yerel + izleme servisi IP'si (ayrıntılı çıktıyı dışarı açma)
    location = /health {
        allow 127.0.0.1;
        # allow <IZLEME_SERVISI_IP>;
        deny all;
        access_log off;
        include snippets/mj-proxy-api.conf;
    }

    location / { return 404; }
}

# ───────── WEB (mağaza) ─────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name maeyja.com;

    ssl_certificate     /etc/letsencrypt/live/maeyja.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/maeyja.com/privkey.pem;
    include snippets/mj-ssl.conf;
    include snippets/mj-headers.conf;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), browsing-topics=()" always;
    # CSP: Next proxy.ts (nonce) — burada eklenmez

    access_log /var/log/nginx/web.access.log mj;
    error_log  /var/log/nginx/web.error.log warn;

    client_max_body_size  1m;
    client_header_timeout 15s;
    client_body_timeout   15s;
    send_timeout          30s;
    keepalive_timeout     30s;
    large_client_header_buffers 4 8k;
    limit_conn mj_conn 40;

    location ~ /\.(?!well-known) { return 404; }

    # BFF kimlik uçları
    location ~ ^/api/auth/(login|register|forgot-password|reset-password)$ {
        limit_req zone=mj_auth burst=5 nodelay;
        client_max_body_size 16k;
        include snippets/mj-proxy.conf;
        proxy_pass http://mj_web;
    }

    location /api/ {
        limit_req zone=mj_api burst=40 nodelay;
        include snippets/mj-proxy.conf;
        proxy_pass http://mj_web;
    }

    location / {
        limit_req zone=mj_web burst=60 nodelay;
        include snippets/mj-proxy.conf;
        proxy_pass http://mj_web;
    }
}

# ───────── ADMIN ─────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin.maeyja.com;

    ssl_certificate     /etc/letsencrypt/live/maeyja.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/maeyja.com/privkey.pem;
    include snippets/mj-ssl.conf;
    include snippets/mj-headers.conf;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" always;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;

    include snippets/mj-admin-allow.conf;             # opsiyonel IP allowlist (MFA'nın yerine geçmez)

    access_log /var/log/nginx/admin.access.log mj;
    error_log  /var/log/nginx/admin.error.log warn;

    client_max_body_size  1m;                         # yükleme yalnız aşağıdaki media yolunda
    client_header_timeout 15s;
    client_body_timeout   15s;
    send_timeout          30s;
    keepalive_timeout     30s;
    large_client_header_buffers 4 8k;
    limit_conn mj_conn 30;

    location ~ /\.(?!well-known) { return 404; }

    location ~ ^/api/auth/(login|admin/login|admin/login/mfa|forgot-password|reset-password)$ {
        limit_req zone=mj_auth burst=5 nodelay;
        client_max_body_size 16k;
        include snippets/mj-proxy.conf;
        proxy_pass http://mj_admin;
    }

    # Medya yükleme (BFF yolunu kendi route'una göre güncelle); API tarafında 15 MB limiti ayrıca uygulanır
    location = /api/admin/media {
        limit_req zone=mj_admin burst=10 nodelay;
        client_max_body_size 20m;
        include snippets/mj-proxy.conf;
        proxy_pass http://mj_admin;
    }

    location /api/ {
        limit_req zone=mj_admin burst=30 nodelay;
        include snippets/mj-proxy.conf;
        proxy_pass http://mj_admin;
    }

    location / {
        limit_req zone=mj_admin burst=30 nodelay;
        include snippets/mj-proxy.conf;
        proxy_pass http://mj_admin;
    }
}
```

**Kurulum ve doğrulama**
```bash
mkdir -p /var/www/certbot
certbot certonly --webroot -w /var/www/certbot \
  -d maeyja.com -d www.maeyja.com -d admin.maeyja.com -d api.maeyja.com \
  --deploy-hook "systemctl reload nginx"
# İlk kez: sertifika dosyaları yokken `nginx -t` 443 bloklarında hata verir → önce `systemctl stop nginx && certbot certonly --standalone -d …` ile sertifikayı al,
# ya da yalnız :80 bloğunu içeren geçici bir yapılandırma kullan; sonra yukarıdaki yapıyı etkinleştir.
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/maeyja.conf /etc/nginx/sites-enabled/maeyja.conf
nginx -t && systemctl reload nginx
curl -sI https://api.maeyja.com/health | head -1                                  # 403 (public'ten kapalı)
curl -s -o /dev/null -w '%{http_code}\n' https://api.maeyja.com/api/admin/orders  # 404
curl -s -o /dev/null -w '%{http_code}\n' -H 'X-Forwarded-For: 1.2.3.4' https://api.maeyja.com/api/catalog/products   # IP sahteciliği DVT-02: audit/limit IP'si değişmemeli
```
Backend `.env` (sunucu): `TRUST_PROXY=1`, `LISTEN_HOST=127.0.0.1`, `NODE_ENV=production`, `SWAGGER_ENABLED=false`, `API_URL=https://api.maeyja.com`, `WEB_URL=https://maeyja.com`, `ADMIN_URL=https://admin.maeyja.com`, `UPLOAD_PUBLIC_URL=https://api.maeyja.com/uploads`, `CORS_ORIGINS=https://maeyja.com,https://admin.maeyja.com`. Web/admin `.env`: `API_URL=http://127.0.0.1:4000/api`, `NEXT_PUBLIC_SITE_URL=https://maeyja.com` (admin: `https://admin.maeyja.com`), web `IMAGE_HOSTS=api.maeyja.com`.
