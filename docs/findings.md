# Vault Chat — Bulgular

**Tarih:** 2026-10-22 · **Branch:** `vault-with-claude` · **Kapsam:** tüm uygulama kodu (salt okuma incelemesi)
**Bağlam:** `CLAUDE.md`, `UMLs/*.puml`
**Hedef:** Gerçek kullanıcılara açık bir uygulama. Öncelik sırası: güvenlik → çalışmayan özellikler → sağlamlık → kod kalitesi.
**Ortam:** Railway üzerinde container (Docker) olarak çalışıyor (`public/sw.js:21`, `.gitignore` → `Dockerfile`). Sunucu sürekli açık kalan bir Node.js süreci.

Önem dereceleri:
- 🔴 **Kritik:** veri sızıntısı veya yetkisiz erişim
- 🟠 **Yüksek:** özellik çalışmıyor ya da yanlış çalışıyor
- 🟡 **Orta:** sağlamlık, hata yönetimi, kötüye kullanım
- 🔵 **Düşük:** bakım ve kod kalitesi

Doğrulama durumu:
- **Kodda doğrulandı:** bulgu yalnızca kod okunarak kesinleşti.
- **Çalıştırılarak doğrulanacak:** kesinleşmesi için uygulamanın çalıştırılması gerekiyor.

---

## Özet

| ID | Önem | Başlık |
|---|---|---|
| F-01 | 🔴 | Mesaj geçmişi API'leri üyelik kontrolü yapmıyor |
| F-02 | 🔴 | Socket.IO olayları tüm istemcilere yayınlanıyor, kimlik doğrulama yok |
| F-03 | 🔴 | LiveKit token'ı yetki kontrolü olmadan veriliyor, kimliğe bürünme mümkün |
| F-04 | 🔴 | Push aboneliği global ve `sendNotification` herkese açık |
| F-05 | 🟠 | `useChatQuery` / `ChatMessages`: hook kuralları ihlal ediliyor, sayfalama çalışmıyor |
| F-06 | 🟠 | Push aboneliği yanlış kodlanıyor ve hiçbir olaya bağlı değil |
| F-07 | 🟠 | `return RedirectToSignIn` yönlendirme yapmıyor |
| F-08 | 🟠 | Özel sohbet hedef üyeyi doğrulamıyor |
| F-09 | 🟡 | Sunucu Admin/Moderatörü özel sohbetteki mesajları silebiliyor |
| F-10 | 🟡 | Girdi doğrulaması yok (içerik, rol, fileUrl) |
| F-11 | 🟡 | "Bulunamadı" ve "yetkisiz" durumları 500 dönüyor |
| F-12 | 🟡 | API route'larında `currentProfile()` yan etki yaratıyor ve redirect fırlatıyor |
| F-13 | 🟡 | Hız sınırı (rate limiting) yok |
| F-14 | 🟡 | Dosya türü URL uzantısından tahmin ediliyor |
| F-15 | 🟡 | "(Düzenlendi)" etiketi string karşılaştırmasına dayanıyor |
| F-16 | 🔵 | Test, CI ve tip denetimi yok; lint kuralları kapatılmış |
| F-17 | 🔵 | Bağımlılık sorunları (kullanılmayan paketler, sürüm uyumsuzlukları) |
| F-18 | 🔵 | Ölü kod ve küçük hatalar |
| F-19 | 🔵 | Arayüz dili tutarsız |
| F-20 | 🔵 | Dokümantasyon ve yapılandırma eksikleri |
| F-21 | 🔵 | Sohbet erişim sorgusundaki `OR` koşulu tek başına test edilmiyor |
| F-22 | 🟡 | `useChatQuery` 403 yanıtını JSON olarak okumaya çalışıyor |
| F-23 | 🔵 | `canAccessChat` sohbet kimliği için önce boşuna kanal sorgusu yapıyor |
| F-24 | 🔵 | Başka bir sohbete ait cursor sayfadan mesaj düşürebiliyor |

---

## 🔴 Kritik

### F-01: Mesaj geçmişi API'leri üyelik kontrolü yapmıyor
- **Yer:** `app/api/messages/route.ts:10-58`, `app/api/direct-messages/route.ts:10-58`
- **Kanıt:** Kod yalnızca `profile` var mı diye bakıyor. Ardından `where: { channelId }` veya `where: { conversationId }` ile doğrudan `findMany` çağrılıyor. Kanalın sunucusunda üyelik ya da sohbetin tarafı olma kontrolü hiç yok.
- **Etki:** Giriş yapmış herhangi bir kullanıcı, ID'sini bildiği her kanalın ve her özel sohbetin geçmişini okuyabilir. Bu ID'ler URL'de ve socket olaylarında açıkça görünüyor (bkz. F-02).
- **Durum:** Kodda doğrulandı.

### F-02: Socket.IO olayları tüm istemcilere yayınlanıyor, kimlik doğrulama yok
- **Yer:** `pages/api/socket/io.ts:17-21`, `pages/api/socket/messages/index.ts:81`, `pages/api/socket/messages/[messageId].ts:130`, `pages/api/socket/direct-messages/index.ts:86`, `pages/api/socket/direct-messages/[directMessageId].ts:132`, `components/ui/providers/socket-provider.tsx:30`
- **Kanıt:**
  - Sunucu `io.emit(key, message)` kullanıyor; bu, olayı bağlı **tüm** soketlere gönderir. Oda (`join`/`to`) kavramı hiç yok.
  - Socket sunucusunda bağlantıyı doğrulayan bir middleware (`io.use`) yok.
  - `/api/socket/io` yolu `middleware.ts` matcher'ına girse de WebSocket upgrade isteği Clerk tarafından korunmuyor.
- **Etki:** Bağlanan her istemci, tüm kanalların ve tüm özel sohbetlerin yeni, düzenlenen ve silinen mesajlarını (gönderenin profil bilgileri ve e-posta dahil) canlı alır. Bunun için tarayıcı konsolunda `socket.onAny(console.log)` yazmak yeterli.
- **Ek:** Mesaj payload'ı `member.profile` içeriyor. Bu da `email` alanının diğer kullanıcılara gitmesi demek. Aynı durum F-01'deki GET yanıtları için de geçerli.
- **Durum:** Kodda doğrulandı.

### F-03: LiveKit token'ı yetki kontrolü olmadan veriliyor, kimliğe bürünme mümkün
- **Yer:** `app/api/livekit/route.ts:5-25`, `components/media-room.tsx:166`
- **Kanıt:**
  - `room` ve `username` query parametrelerinden alınıyor.
  - Kullanıcının o kanal veya sohbetin üyesi olup olmadığına bakılmıyor.
  - `identity` olarak istemcinin gönderdiği `username` kullanılıyor.
- **Etki:** Giriş yapmış herhangi bir kullanıcı herhangi bir ses/görüntü odasına başka bir isimle katılabilir, yayın yapabilir ve dinleyebilir. Aynı ad-soyada sahip iki kullanıcı aynı `identity`'yi alır ve biri diğerini odadan düşürür.
- **Durum:** Kodda doğrulandı.

### F-04: Push aboneliği global ve `sendNotification` herkese açık
- **Yer:** `app/actions.ts:5-48`
- **Kanıt:**
  - `let subscription` modül seviyesinde tek bir değişken. Bu yüzden son abone olan kişi, önceki tüm abonelerin yerine geçiyor.
  - `subscribeUser`, `unsubscribeUser` ve `sendNotification` server action'ları kimlik doğrulama yapmıyor.
  - VAPID iletişim adresi yer tutucu olarak kalmış: `'<mailto:your-email@example.com>'`.
- **Etki:** Herhangi bir istemci server action'ı çağırarak son abone olan kişiye istediği metinle bildirim gönderebilir. Abonelikler sunucu yeniden başladığında kaybolur.
- **Durum:** Kodda doğrulandı.

---

## 🟠 Yüksek

### F-05: `useChatQuery` / `ChatMessages`: hook kuralları ihlal ediliyor, sayfalama çalışmıyor
- **Yer:** `hooks/use-chat-query.ts:13`, `components/chat/chat-messages.tsx:59-72`
- **Kanıt:**
  - `useChatQuery` bir `async` fonksiyon ve içinde `useInfiniteQuery` çağrılıyor. Bu yüzden Promise döndürüyor.
  - `ChatMessages` her render'da `.then(e => { setData(...); setStatus(...) })` çalıştırıyor; yani render sırasında state güncelleniyor.
  - `.then` içinde `let { fetchNextPage, hasNextPage, ... } = e` ile yeni yerel değişkenler tanımlanıyor. Dışarıdaki `fetchNextPage`, `hasNextPage` ve `isFetchingNextPage` hiç atanmıyor.
- **Etki:**
  - "Önceki mesajları yükle" butonu ve yukarı kaydırınca yükleme hiç çalışmıyor; yalnızca son 10 mesaj görünüyor.
  - `hasNextPage` hep `undefined` olduğu için uzun kanallarda da "Hoş geldin" ekranı gösteriliyor.
  - Her render yeni bir state güncellemesi tetikliyor, bu da gereksiz render döngülerine yol açıyor.
- **Durum:** Kodda doğrulandı. Davranış çalıştırılarak da gözlenecek.

### F-06: Push aboneliği yanlış kodlanıyor ve hiçbir olaya bağlı değil
- **Yer:** `components/modals/initial-modal.tsx:73-79, 162`, `app/actions.ts`, `public/sw.js:21`
- **Kanıt:**
  - `p256dh` ve `auth` anahtarları `TextDecoder().decode(ArrayBuffer)` ile string'e çevriliyor. Web Push bu anahtarları base64url olarak bekliyor; doğrusu `sub.toJSON().keys` kullanmak.
  - `PushNotificationManager` ve `InstallPrompt` yalnızca kullanılmayan `export default Page` içinde render ediliyor; ekranda hiç görünmüyorlar.
  - Yeni mesaj geldiğinde bildirim gönderen bir kod yok.
  - `sw.js` bildirime tıklanınca sabit kodlu bir Railway URL'sine gidiyor.
  - İstemci bileşeni sunucu kütüphanesi olan `web-push`'u import ediyor (satır 22).
- **Etki:** Push bildirimi özelliği fiilen yok, kod yarım kalmış durumda.
- **Durum:** Kodda doğrulandı.

### F-07: `return RedirectToSignIn` yönlendirme yapmıyor
- **Yer:** `app/(main)/(routes)/servers/[serverId]/layout.tsx:16`, `.../servers/[serverId]/page.tsx:20`, `.../channels/[channelId]/page.tsx:25`, `.../conversations/[memberId]/page.tsx:31`
- **Kanıt:** Kod bileşenin kendisini (fonksiyon referansını) döndürüyor, `<RedirectToSignIn />` elementini değil. Server Component'ten bir fonksiyon döndürmek geçersiz.
- **Etki:** Clerk oturumu var ama `currentProfile()` null döndüğünde (bkz. F-12) sayfa çöküyor. Middleware çoğu durumu önceden yakaladığı için nadir görülür, ama kod hatalı.
- **Durum:** Kodda doğrulandı.

### F-08: Özel sohbet hedef üyeyi doğrulamıyor
- **Yer:** `app/(main)/(routes)/servers/[serverId]/conversations/[memberId]/page.tsx:47`, `lib/conversation.ts`
- **Kanıt:** URL'deki `memberId`, `getOrCreateConversation`'a olduğu gibi veriliyor. Bu üyenin aynı sunucuda olup olmadığı ya da kullanıcının kendisi olup olmadığı kontrol edilmiyor.
- **Etki:**
  - Kullanıcı kendisiyle sohbet açabilir.
  - Başka bir sunucudaki herhangi bir üyeye (ID'sini biliyorsa) özel mesaj atabilir.
  - Geçersiz bir ID verildiğinde `create` hata fırlatır ve sessizce yönlendirme yapılır.
- **Durum:** Kodda doğrulandı.

---

## 🟡 Orta

### F-09: Sunucu Admin/Moderatörü özel sohbetteki mesajları silebiliyor
- **Yer:** `pages/api/socket/direct-messages/[directMessageId].ts:81-83`
- **Kanıt:** `canModify` hesaplanırken üyenin **sunucudaki** rolü (ADMIN veya MODERATOR) kullanılıyor.
- **Etki:** Bir özel sohbetin tarafı olan sunucu moderatörü, karşı tarafın özel mesajlarını silebilir. Özel sohbetlerde silme yetkisi yalnızca mesajın sahibinde olmalı.
- **Durum:** Kodda doğrulandı.

### F-10: Girdi doğrulaması yok
- **Yer:**
  - `pages/api/socket/messages/index.ts:15`, `.../messages/[messageId].ts:15`, `.../direct-messages/index.ts:15`, `.../direct-messages/[directMessageId].ts:15`
  - `app/api/members/[memberId]/route.ts:13`
  - `app/api/servers/route.ts`, `app/api/servers/[serverId]/route.ts`, `app/api/channels/*`
- **Kanıt:**
  - `content` için uzunluk sınırı yok ve PATCH'te boş içerik kabul ediliyor.
  - `fileUrl` için herhangi bir URL kabul ediliyor (UploadThing kökenli olduğu kontrol edilmiyor).
  - `role` değeri enum'a karşı doğrulanmıyor.
  - `name` ve `type` (kanal) doğrulanmıyor.
- **Etki:**
  - Çok büyük mesajlarla veritabanı şişirilebilir.
  - `next/image` izin verilmeyen bir alan adı görünce hata verir ve mesaj listesi çöker.
  - Rastgele bağlantılar "dosya" gibi gösterilebilir.
- **Durum:** Kodda doğrulandı.

### F-11: "Bulunamadı" ve "yetkisiz" durumları 500 dönüyor
- **Yer:** `app/api/servers/[serverId]/route.ts:15,41`, `app/api/channels/[channelId]/route.ts`, `app/api/members/[memberId]/route.ts`, `app/api/servers/[serverId]/leave/route.ts`, `app/(invite)/(routes)/invite/[inviteCode]/page.tsx:38`
- **Kanıt:** Yetki, `update`/`delete` sorgusunun `where` koşulunda kontrol ediliyor. Koşul tutmadığında Prisma `P2025` hatası fırlatıyor, `catch` bloğu da bunu 500 olarak döndürüyor. Geçersiz bir davet kodu ise sayfanın çökmesine yol açıyor.
- **Etki:** İstemci yetkisiz işlemi gerçek bir sunucu hatasından ayıramıyor; loglar sahte hatalarla doluyor; geçersiz davet linki hata sayfası gösteriyor.
- **Durum:** Kodda doğrulandı.

### F-12: API route'larında `currentProfile()` yan etki yaratıyor ve redirect fırlatıyor
- **Yer:** `lib/current-profile.ts:19`, `lib/inital-profile.ts:10`
- **Kanıt:** Profil bulunamadığında `currentProfile()`, `initialProfile()`'ı çağırıyor. Bu fonksiyon ya profil oluşturuyor ya da `redirect("/home")` fırlatıyor. Aynı fonksiyon API route'larında da kullanılıyor.
- **Etki:** Bir GET isteği veritabanına yazabiliyor. Bir API isteği JSON yerine yönlendirme dönebiliyor. "Profil getir" ile "profil oluştur" sorumlulukları birbirine karışmış.
- **Durum:** Kodda doğrulandı.

### F-13: Hız sınırı (rate limiting) yok
- **Yer:** Mesaj gönderme, sunucu oluşturma, davet kodu yenileme ve LiveKit token endpoint'leri.
- **Etki:** Spam ve kötüye kullanım; LiveKit ile UploadThing maliyetlerinde artış.
- **Durum:** Kodda doğrulandı.

### F-14: Dosya türü URL uzantısından tahmin ediliyor
- **Yer:** `components/chat/chat-item.tsx:121-130`, `components/file-upload.tsx`
- **Kanıt:** `fileUrl.split(".").pop() === "pdf"`. UploadThing v7 URL'leri (`https://<app>.ufs.sh/f/<key>`) uzantı içermeyebilir.
- **Etki:** PDF dosyaları resim olarak gösterilmeye çalışılır ve görüntü kırık çıkar.
- **Durum:** Çalıştırılarak doğrulanacak.

### F-15: "(Düzenlendi)" etiketi string karşılaştırmasına dayanıyor
- **Yer:** `components/chat/chat-messages.tsx:121`
- **Kanıt:** `message.updatedAt !== message.createdAt`. Bu iki alan iki ayrı zaman damgası olarak üretiliyor; JSON'dan gelen string'lerin milisaniyesi bile farklıysa etiket görünüyor.
- **Etki:** Hiç düzenlenmemiş mesajlarda da "(Düzenlendi)" etiketi görünebilir.
- **Durum:** Çalıştırılarak doğrulanacak.

---

## 🔵 Düşük

### F-16: Test, CI ve tip denetimi yok; lint kuralları kapatılmış
- Hiç test dosyası ve test script'i yok. CI yapılandırması da yok.
- `.eslintrc.json` şu kuralları kapatıyor: `no-explicit-any`, `exhaustive-deps`, `ban-ts-comment`, `prefer-const` ve diğerleri.
- `app/(setup)/page.tsx:14` içinde `@ts-ignore` var.
- Ayrı bir `typecheck` script'i yok.

### F-17: Bağımlılık sorunları
- Kullanılmayan paketler: `mongodb`, `mongoose` (veritabanı erişimi Prisma ile yapılıyor), `swiper`.
- React `19.0.0-rc` ile `@types/react@^18` uyumsuz; bu da `legacy-peer-deps=true` gerektiriyor.
- `eslint-config-next` 15.0.3 sürümünde, `next` ise 15.0.7.
- `next.config.ts:6`: `images.domains` artık önerilmiyor (`remotePatterns` kullanılmalı). `*.ufs.sh` alan adı da listede yok.

### F-18: Ölü kod ve küçük hatalar
- `components/modals/initial-modal.tsx`: kullanılmayan `Page`, `PushNotificationManager` ve `InstallPrompt` bileşenleri var. `InitialModal` ise `router.refresh()` sonrasında bir de `window.location.reload()` çağırıyor.
- `app/layout.tsx:35`: `manifest()` boşuna çağrılıyor.
- `components/chat/chat-messages.tsx:109`: `animate-sping` yazım hatası; olması gereken `animate-spin`.
- `hooks/use-origin.ts:5`: `useEffect` bağımlılık dizisi olmadan yazılmış, her render'da çalışıyor.
- `components/chat/chat-item.tsx`: her mesaj kendi `window` keydown dinleyicisini ekliyor.
- `prisma/schema.prisma:104`: `Message.messageID` alanı gereksiz.
- `hooks/use-chat-query.ts:43`: gerçek zamanlı akış dururken (`isConnected` kontrolü yorum satırına alınmış) 60 saniyelik polling'e geri dönülüyor.
- `lib/inital-profile.ts`: dosya adında yazım hatası var (`inital`).

### F-19: Arayüz dili tutarsız
- Arayüzde İngilizce ve Türkçe metinler karışık: "This message has been deleted" (sunucuda yazılıyor), "Message #kanal", "Edit/Delete" tooltip'leri, rol adları, push bileşenlerindeki metinler.
- Silme modalı "Mesaj tamamen silinecek" diyor (`delete-message-modal.tsx:46`), oysa silme yumuşak silme (soft delete) ile yapılıyor.

### F-20: Dokümantasyon ve yapılandırma eksikleri
- `README.md` hâlâ Next.js şablonu; son satırı UTF-16 kodlamasından dolayı bozuk görünüyor.
- `.env.example` yok.
- `Dockerfile` `.gitignore` içinde; bu yüzden dağıtım yöntemi repoda tanımlı değil.
- `public/sw.js`, `/badge.png` dosyasına ve sabit kodlu bir URL'ye başvuruyor.
- `prisma/schema.prisma`: mesaj sorguları `channelId` ile filtreleyip `createdAt` ile sıralıyor. Bunun için birleşik bir indeks (`@@index([channelId, createdAt])`) yok; aynı durum `conversationId` için de geçerli.

---

## Sonradan eklenenler (Paket 3 bağımsız incelemesi)

Aşağıdaki maddeler Görev 3'ün (F-01) bağımsız incelemesinde bulundu. Hiçbiri F-01'in kapanmasını engellemiyor; her birinin ele alınacağı görev belirtildi.

### F-21: Sohbet erişim sorgusundaki `OR` koşulu tek başına test edilmiyor
- **Yer:** `lib/auth/access.ts` (`getConversationAccess`), `tests/lib/auth/access.test.ts`
- **Kanıt:** Yetki iki katmanda kontrol ediliyor: Prisma `where` içindeki `OR: [{ memberOne: { profileId } }, { memberTwo: { profileId } }]` ve ardından kodda profilin tarafını seçen kontrol. `OR` koşulu silinse bile ikinci kontrol üçüncü kişi için `null` döndürdüğü için testler geçmeye devam ediyor.
- **Etki:** Bugün güvenlik açığı yok. Ancak iki katmandan biri kaldırılırsa testler bunu fark etmez; savunma tek katmana düşer.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 4 (`canAccessChat`'in ilk tüketicisi; erişim testleri orada genişletilecek). `db.conversation.findFirst` çağrısının `OR` koşuluyla yapıldığını doğrulayan bir test eklenmeli.

### F-22: `useChatQuery` 403 yanıtını JSON olarak okumaya çalışıyor
- **Yer:** `hooks/use-chat-query.ts:29-30`
- **Kanıt:** `fetchMessages`, `res.ok` kontrolü yapmadan `res.json()` çağırıyor. F-01 düzeltmesinden sonra üye olmayan (örneğin sunucudan atılmış) kullanıcıya düz metin `"Forbidden"` dönüyor ve JSON ayrıştırması hata fırlatıyor.
- **Etki:** Sunucudan atılan kullanıcının açık sekmesinde sohbet hata durumuna düşüyor; React Query 3 kez yeniden deniyor ve 60 saniyede bir yeniden çekmeye devam ediyor. Üyeler etkilenmiyor.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 8 (F-05, aynı dosya yeniden yazılıyor). `res.ok` değilse anlamlı bir hata fırlatılmalı ve 401/403'te yeniden deneme kapatılmalı.

### F-23: `canAccessChat` sohbet kimliği için önce boşuna kanal sorgusu yapıyor
- **Yer:** `lib/auth/access.ts` (`canAccessChat`)
- **Kanıt:** Fonksiyon önce `getChannelAccess`, sonuç yoksa `getConversationAccess` çağırıyor. Sohbet kimliği verildiğinde her seferinde bir `channel.findUnique` boşa gidiyor.
- **Etki:** Socket odasına her katılma denetiminde bir ek veritabanı turu. Performans etkisi küçük.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 4 (socket handshake ve oda katılımı `canAccessChat`'i kullanacak). İki sorgu paralel çalıştırılabilir ya da istemci sohbet türünü bildirebilir.

### F-24: Başka bir sohbete ait cursor sayfadan mesaj düşürebiliyor
- **Yer:** `app/api/messages/route.ts`, `app/api/direct-messages/route.ts` (cursor dalı, `skip: 1`)
- **Kanıt:** Sorgu `where: { channelId }` / `where: { conversationId }` ile sınırlı olduğu için veri sızmıyor. Ancak cursor başka bir sohbetin mesajını gösterirse `skip: 1` meşru bir mesajı atlayabiliyor ya da sayfa boş dönüyor. F-01 öncesinde de vardı.
- **Etki:** Güvenlik sorunu değil; kurcalanmış istekte sayfalama tutarsızlığı.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 8 (sayfalama). Görev 8'in dosya listesine iki geçmiş route'u eklenmeli; cursor'ın aynı sohbete ait olduğu doğrulanmalı, değilse 400 dönülmeli.
