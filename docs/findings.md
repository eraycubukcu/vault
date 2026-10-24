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
| F-03 | 🔴 | ~~LiveKit token'ı yetki kontrolü olmadan veriliyor, kimliğe bürünme mümkün~~ (Görev 6'da kapandı) |
| F-04 | 🔴 | ~~Push aboneliği global ve `sendNotification` herkese açık~~ (Görev 7'de kapandı) |
| F-05 | 🟠 | `useChatQuery` / `ChatMessages`: hook kuralları ihlal ediliyor, sayfalama çalışmıyor |
| F-06 | 🟠 | ~~Push aboneliği yanlış kodlanıyor ve hiçbir olaya bağlı değil~~ (Görev 7'de kapandı) |
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
| F-21 | 🔵 | ~~Sohbet erişim sorgusundaki `OR` koşulu tek başına test edilmiyor~~ (Görev 4'te kapandı) |
| F-22 | 🟡 | `useChatQuery` 403 yanıtını JSON olarak okumaya çalışıyor |
| F-23 | 🔵 | ~~`canAccessChat` sohbet kimliği için önce boşuna kanal sorgusu yapıyor~~ (Görev 4'te kapandı) |
| F-24 | 🔵 | Başka bir sohbete ait cursor sayfadan mesaj düşürebiliyor |
| F-25 | 🟡 | ~~Socket kimliği yalnızca bağlanırken doğrulanıyor; hesap değişince socket eski profilde kalıyor~~ (Görev 5'te kapandı) |
| F-26 | 🔵 | Socket token doğrulamasında `authorizedParties` (azp) kontrolü yok |
| F-27 | 🔵 | Üye atma/ayrılma, yetki kontrolünden önce ek okuma sorguları çalıştırıyor (atma kısmı Görev 5'te kapandı) |
| F-28 | 🟡 | `chat:join` için hız sınırı yok |
| F-29 | 🔵 | ~~Kanal ya da sunucu silinince socket'ler odalarda kalıyor~~ (Görev 5'te kapandı) |
| F-30 | 🔵 | Mesaj handler'ları oda adını veritabanı satırından değil query'den alıyor |
| F-31 | 🔵 | ~~`/home` sayfası `async` tanımlı bir Client Component~~ (Paket 4 sonrası düzeltildi) |
| F-32 | 🔴 | ~~Next, socket'in WebSocket upgrade'ini kapatıyor; `chat:join` sunucuya ulaşmıyor, canlı mesajlar gelmiyor~~ (Paket 4 sonrası düzeltildi) |
| F-33 | 🔵 | `auth:refresh` sürerken socket koparsa yeniden doğrulama zamanlayıcısı tekrar kuruluyor |
| F-34 | 🟡 | `auth:refresh` için hız sınırı yok |
| F-35 | 🔵 | Atma/ayrılmada silinen özel sohbetin karşı tarafı odada kalıyor |
| F-36 | 🔵 | `getOwnedServerChatIds` tüm üye ID'lerini `$in` listesiyle sorguluyor |
| F-37 | 🔵 | `SocketProvider`'da paylaşılan `retry` değişkeni bir zamanlayıcıyı kaçırabiliyor |
| F-38 | 🟡 | Sunucudan atılan, ayrılan ya da kanalı silinen kullanıcı LiveKit odasında kalıyor |
| F-39 | 🔵 | LiveKit odasında görünen ad eşsiz değil; aynı ad-soyadla başkası gibi görünmek hâlâ mümkün |
| F-40 | 🔵 | `MediaRoom` token hatasında yeniden deneme sunmuyor |
| F-41 | 🔵 | Paket 6 testlerinde iki boşluk: sohbet oda adı ve kamera butonu bağlantısı |

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
  - ~~`/api/socket/io` yolu `middleware.ts` matcher'ına girse de WebSocket upgrade isteği Clerk tarafından korunmuyor.~~ Düzeltme: Next upgrade isteğinde de middleware'i çalıştırıyor (bkz. F-32).
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
- **Kapanış (Görev 6):** Token yalnızca kanalın sunucusundaki üyeye ya da özel sohbetin tarafına veriliyor (`getChannelAccess` / `getConversationAccess`); TEXT kanal için verilmiyor. Oda adı DB satırının kimliği. `identity = profile.id`, `name = profile.name`; `username` parametresi kaldırıldı. Ömür 10 dakika, `canUpdateOwnMetadata: false`, yönetici yetkisi yok. Sesli kanalda token `camera` kaynağını içermiyor ve kamera butonu gizleniyor. Ancak LiveKit parça kaynağını istemcinin beyanına göre kabul ediyor; değiştirilmiş bir istemci kamerasını `screen_share` olarak yayınlayabilir. Bu bir arayüz kuralı, güvenlik garantisi değil. Testler: `tests/app/api/livekit.test.ts`, `tests/components/media-room.test.tsx`. Atılan kullanıcının açık bağlantısı için bkz. F-38.

### F-04: Push aboneliği global ve `sendNotification` herkese açık
- **Yer:** `app/actions.ts:5-48`
- **Kanıt:**
  - `let subscription` modül seviyesinde tek bir değişken. Bu yüzden son abone olan kişi, önceki tüm abonelerin yerine geçiyor.
  - `subscribeUser`, `unsubscribeUser` ve `sendNotification` server action'ları kimlik doğrulama yapmıyor.
  - VAPID iletişim adresi yer tutucu olarak kalmış: `'<mailto:your-email@example.com>'`.
- **Etki:** Herhangi bir istemci server action'ı çağırarak son abone olan kişiye istediği metinle bildirim gönderebilir. Abonelikler sunucu yeniden başladığında kaybolur.
- **Durum:** Kodda doğrulandı.
- **Kapanış (Görev 7):** Abonelikler `PushSubscription` modelinde, profile bağlı ve `endpoint` başına tek kayıt olarak saklanıyor. `subscribeUser` oturum istiyor ve girdiyi doğruluyor: `https` endpoint, base64url anahtarlar. `unsubscribeUser(endpoint)` yalnızca `{ endpoint, profileId }` koşuluyla siliyor. `sendNotification` action'ı silindi. Bildirim yalnızca sunucu içinden `lib/push.ts#notifyProfile` ile gönderiliyor (`server-only`). VAPID adresi yeni `VAPID_SUBJECT` ortam değişkeninden okunuyor; değişken `.env.example`'a ve `CLAUDE.md`'ye Görev 15'te eklenecek. Ayarlar her çağrıda okunuyor, bu yüzden modül yüklenirken artık hata fırlatılmıyor (eskiden yer tutucu adres yüzünden `app/actions.ts` içe aktarılınca hata veriyordu). Testler: `tests/app/actions.test.ts`, `tests/lib/push.test.ts`.

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
- **Kapanış (Görev 7):** İstemci aboneliği `sub.toJSON()` ile gönderiyor; `TextDecoder` ve istemcideki `web-push` import'u kaldırıldı. Ölü `Page`, `PushNotificationManager` ve `InstallPrompt` silindi. Yeni `components/push-toggle.tsx` sol çubukta (tema düğmesinin üstünde) aç/kapat düğmesi sunuyor ve açılışta mevcut tarayıcı aboneliğini oturumdaki profile bağlıyor. Özel mesaj kaydedildikten sonra, alıcının hiçbir socket'i `chat:{conversationId}` odasında değilse alıcıya bildirim gidiyor. Başlık gönderenin adı, gövde içeriğin ilk 120 karakteri, URL `/servers/{serverId}/conversations/{gönderenin üye kimliği}`. Çağrı `await` edilmiyor; hatası loglanıyor. 404/410 dönen abonelik siliniyor. `sw.js` bildirimin `url`'sini (yalnızca aynı origin) açıyor ve olmayan `/badge.png` kaldırıldı. Kanal bildirimleri kapsam dışı. Testler: `tests/pages/api/socket/direct-messages-push.test.ts`, `tests/components/push-toggle.test.tsx`. Elle doğrulama: `docs/elle-test.md` Paket 7.

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
- **Kapandı (Görev 4):** `tests/lib/auth/access.test.ts` içinde `where.OR` koşulunu doğrulayan test eklendi; `OR` silinince testin düştüğü doğrulandı.

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
- **Kapandı (Görev 4):** İki sorgu `Promise.all` ile paralel çalışıyor. Bekleme süresi kısaldı, ancak kanal kimliklerinde de sohbet sorgusu çalıştığı için toplam sorgu sayısı 2'den 3'e çıktı. İstemcinin sohbet türünü bildirmesi ileride bu maliyeti kaldırabilir.

### F-24: Başka bir sohbete ait cursor sayfadan mesaj düşürebiliyor
- **Yer:** `app/api/messages/route.ts`, `app/api/direct-messages/route.ts` (cursor dalı, `skip: 1`)
- **Kanıt:** Sorgu `where: { channelId }` / `where: { conversationId }` ile sınırlı olduğu için veri sızmıyor. Ancak cursor başka bir sohbetin mesajını gösterirse `skip: 1` meşru bir mesajı atlayabiliyor ya da sayfa boş dönüyor. F-01 öncesinde de vardı.
- **Etki:** Güvenlik sorunu değil; kurcalanmış istekte sayfalama tutarsızlığı.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 8 (sayfalama). Görev 8'in dosya listesine iki geçmiş route'u eklenmeli; cursor'ın aynı sohbete ait olduğu doğrulanmalı, değilse 400 dönülmeli.

---

## Sonradan eklenenler (Paket 4 bağımsız incelemesi)

Aşağıdaki maddeler Görev 4'ün (F-02) uygulanması ve bağımsız incelemesi sırasında bulundu. İncelemedeki Critical bulgu (yetki kontrolü sürerken atılan kullanıcının odaya geri girmesi) ve oda katılma/ayrılma yarışı Görev 4 içinde düzeltildi. Aşağıdakiler ertelendi.

### F-25: Socket kimliği yalnızca bağlanırken doğrulanıyor; hesap değişince socket eski profilde kalıyor
- **Yer:** `lib/socket/auth.ts`, `components/ui/providers/socket-provider.tsx` (effect bağımlılığı `isSignedIn`)
- **Kanıt:** Token yalnızca handshake sırasında doğrulanıyor. Oturum iptal edilse (başka cihazdan çıkış) ya da profil silinse bile açık socket, daha önce katıldığı odaların olaylarını almaya devam ediyor. Clerk çoklu oturum açıksa hesap değiştirmede `isSignedIn` `true` kaldığı için socket eski profille kalıyor; yeni hesabın `chat:join` istekleri sessizce `ok:false` dönüyor.
- **Etki:** Oturumu kapatılmış bir cihaz, socket kopana kadar yetkili olduğu sohbetleri dinlemeye devam eder. Hesap değiştirince canlı mesajlar gelmez.
- **Durum:** Kodda doğrulandı (çoklu oturum kısmı çalıştırılarak doğrulanacak).
- **Ele alınacağı görev:** Görev 5. Effect `userId`/`sessionId`'ye bağlanmalı. Sunucu tarafında belirli aralıklarla ya da `chat:join` sırasında token süresi kontrol edilip socket koparılabilir.
- **Kapandı (Görev 5):**
  - İstemcideki socket effect'i `userId` ve `sessionId`'ye bağlandı; hesap ya da oturum değişince socket yeniden kuruluyor.
  - İstemci 30 saniyede bir taze token'ı `auth:refresh` ile gönderiyor (`AUTH_REFRESH_INTERVAL_MS`).
  - Sunucu, aynı profile ait geçerli bir token 180 saniye içinde gelmezse socket'i koparıyor (`REAUTH_TIMEOUT_MS`). Başka bir profile ait token gelirse socket'i hemen koparıyor.
  - Sekme görünür olunca istemci beklemeden yeniliyor. 180 saniye, arka plan sekmesinde dakikaya kısılan zamanlayıcıyla bir başarısız yenilemeyi tolere ediyor (bağımsız incelemede M2).
  - Sunucu bağlantıyı kendisi koparınca (`io server disconnect`) istemci 5 saniye sonra taze token ile yeniden deniyor.
  - Oturumu iptal edilmiş bir cihaz bir süre daha dinleyebilir. `verifyToken` ağa gitmeden doğruladığı için, iptal edilen oturumun son token'ı kendi ömrü (~60 sn) boyunca geçerli kalıyor. Bu token'ı tekrar gönderen değiştirilmiş bir istemci için üst sınır ~60 + 180 ≈ 4 dakika; normal istemci token alamadığı için en geç 180 saniyede kopuyor. Testler: `tests/lib/socket/server.test.ts`, `tests/components/socket-provider.test.tsx`, `tests/integration/socket-rooms.test.ts` (`auth:refresh`).

### F-26: Socket token doğrulamasında `authorizedParties` (azp) kontrolü yok
- **Yer:** `lib/socket/auth.ts` (`verifyToken` çağrısı)
- **Kanıt:** `verifyToken` yalnızca `secretKey` ile çağrılıyor. Aynı Clerk örneğini paylaşan başka bir origin için üretilmiş token'lar da kabul ediliyor.
- **Etki:** Aynı Clerk uygulamasını kullanan başka bir ön yüzden alınan token socket'e bağlanmak için kullanılabilir. Tek origin'li bugünkü kurulumda risk düşük.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 14 (yapılandırma). `authorizedParties: [process.env.NEXT_PUBLIC_SITE_URL]` eklenmeli; `dev2` (https) ve üretim origin'leri birlikte düşünülmeli.

### F-27: Üye atma/ayrılma, yetki kontrolünden önce ek okuma sorguları çalıştırıyor
- **Yer:** `app/api/members/[memberId]/route.ts` (DELETE), `app/api/servers/[serverId]/leave/route.ts`
- **Kanıt:** Odadan çıkarılacak sohbetleri bulmak için `member.findFirst` ve `getMemberChatIds` (iki `findMany`) silmeden önce çalışıyor. Sahiplik kontrolü ise sonraki `server.update` `where`'inde. Giriş yapmış herhangi bir kullanıcı bu okumaları tetikleyebiliyor; veri sızmıyor.
- **Etki:** Gereksiz veritabanı yükü.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 12 (hız sınırı) ya da Görev 5 (aynı route'lar). Ön okuma `server: { profileId: profile.id }` koşuluyla sınırlandırılmalı.
- **Kısmen kapandı (Görev 5):** Atma isteğinin ön okuması `server: { profileId: profile.id }` ile sahibe sınırlandı; sahibi olmayanın isteği `getMemberChatIds` çalıştırmıyor. Ayrılma isteği yalnızca isteği yapanın kendi üyeliğini okuduğu için bırakıldı. Sunucu sahibinin kendi sunucusundan ayrılma denemesi hâlâ `member.findFirst` ve iki `findMany` çalıştırıyor (bağımsız incelemede M1). Düzeltme: ön okumaya `server: { profileId: { not: profile.id } }` eklemek. Görev 12'deki hız sınırıyla birlikte ele alınabilir.

### F-28: `chat:join` için hız sınırı yok
- **Yer:** `lib/socket/server.ts` (`chat:join`)
- **Kanıt:** Her `chat:join` 4–6 veritabanı sorgusu çalıştırıyor (iki kez `canAccessChat`, her biri paralel iki sorgu). Giriş yapmış bir istemci bu olayı sınırsız gönderebilir.
- **Etki:** Kötüye kullanımla veritabanı yükü.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 12. Socket başına kayan pencere sınırı veya kısa süreli erişim önbelleği.

### F-29: Kanal ya da sunucu silinince socket'ler odalarda kalıyor
- **Yer:** `app/api/channels/[channelId]/route.ts` (DELETE), sunucu silme route'u
- **Kanıt:** Görev 4 yalnızca üye atma ve sunucudan ayrılmada socket'leri odalardan çıkarıyor. Silinen kanalın ya da sunucunun odalarında socket'ler kalıyor. Yeni mesaj yazılamadığı için veri sızmıyor.
- **Etki:** Bellekte gereksiz oda üyelikleri.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 5 (kanal silmede `socketsLeave` zaten planlı); sunucu silme de aynı göreve eklenmeli.
- **Kapandı (Görev 5):**
  - Kanal silme başarılı olunca `closeChatRooms([channelId])` odadaki tüm socket'leri çıkarıyor.
  - Sunucu silmeden önce `getOwnedServerChatIds` (yalnızca sahip için) kanal ID'lerini ve üyelerin özel sohbet ID'lerini okuyor; silme başarılı olunca bu odalar boşaltılıyor.
  - Test: `tests/integration/socket-rooms.test.ts` ("kanal ve sunucu silinince odaların boşaltılması").

### F-30: Mesaj handler'ları oda adını veritabanı satırından değil query'den alıyor
- **Yer:** `pages/api/socket/messages/index.ts`, `messages/[messageId].ts`, `direct-messages/index.ts`, `direct-messages/[directMessageId].ts`
- **Kanıt:** `emitToChat(channelId as string, ...)` query değerini kullanıyor. Bugün DB sorgusu aynı değerle filtrelendiği için ikisi her zaman eşit.
- **Etki:** Yok; ileride sorgu değişirse oda ile olay anahtarı ayrışabilir.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 10 (girdi doğrulaması, aynı handler'lar). `channel.id` / `conversation.id` kullanılmalı.

### F-31: `/home` sayfası `async` tanımlı bir Client Component
- **Yer:** `app/(home)/home/page.tsx:1, 15`
- **Kanıt:**
  - Dosya `"use client"` ile başlıyor ve `const HomePage = async () => {...}` olarak tanımlı. Bileşen JSX yerine Promise döndürüyor.
  - React bu Promise'i her render'da yeniden görüyor ve tarayıcıda "A component was suspended by an uncached promise..." ile "async/await is not yet supported in Client Components..." hatalarını basıyor.
  - `currentUser`, `db`, `fs` gibi sunucuya özgü import'lar ve başka kullanılmayan import'lar var; sayfa hiçbirini kullanmıyor.
  - `fad47e6` (2025-01-28) commit'inde `"use client"` eklendiğinden beri var. Paket 4'teki SSR hatası (`08ad1bc` ile düzeltildi) sayfanın render edilmesini engellediği için o sırada görünmüyordu.
- **Etki:** Geliştirme ortamında konsol hatası ve gereksiz yeniden render. Sayfa içeriği yine de gösteriliyor.
- **Durum:** Kodda doğrulandı, testte yeniden üretildi. Düzeltildi: `async` ve kullanılmayan import'lar kaldırıldı (`tests/app/home-page.test.tsx`).

### F-32: Next, socket'in WebSocket upgrade'ini kapatıyor; `chat:join` sunucuya ulaşmıyor
- **Yer:** `lib/socket/server.ts` (`SOCKET_PATH = "/api/socket/io"`), `pages/api/socket/io.ts`, `components/ui/providers/socket-provider.tsx`
- **Kanıt:**
  - Socket.IO, Pages route'u olan `/api/socket/io` yolunda dinliyordu. Next'in upgrade işleyicisi (`node_modules/next/dist/server/lib/router-server.js:496`) önce middleware'i çalıştırıyor; geçerli Clerk oturumu olan istek route aramasına devam ediyor, route bulununca `if (matchedOutput) return socket.end()` ile soket kapatılıyor.
  - Elle testte `socket.end()` çağrısının stack'i loglandı: her upgrade 10–40 ms sonra `upgradeHandler` tarafından kapatılıyor. Oturum çerezi olmayan istekte middleware reddettiği için route aranmıyor ve soket kapanmıyor; bu yüzden Node'dan yapılan denemede sorun görünmedi.
  - Soket, istemci upgrade için polling'i duraklattıktan sonra kapanırsa engine.io-client bir daha istek göndermiyor: `chat:join` ve pong sunucuya gitmiyor, oda boş kalıyor (`roomSockets: []`), bağlantı `ping timeout` ile kopuyor. Erken kapanırsa istemci polling'e dönüp çalışıyor; sorun bu yüzden aralıklı görünüyordu.
  - d9d224d öncesinde de soket kapatılıyordu; ancak `io.emit` istemciden sunucuya paket gerektirmediği için fark edilmedi.
- **Etki:** Gerçek zamanlı mesajlar çoğu zaman F5 yapılmadan görünmüyor.
- **Durum:** Elle testte loglarla doğrulandı. Düzeltildi: Socket.IO route'u olmayan `/api/socket/ws` yolunda dinliyor (`lib/socket/path.ts`); `/api/socket/io` yalnızca sunucuyu başlatıyor ve istemci bağlanmadan önce (ve her yeniden bağlanma denemesinde) bu uca istek atıyor. Yolun bir route ile eşleşmemesi `tests/lib/socket/path.test.ts` ile korunuyor. Elle testte mesajlar yenilemeden geliyor; WebSocket'in 101 ile açık kaldığı (elle-test 13. adım) henüz gözle doğrulanmadı.

---

## Sonradan eklenenler (Paket 5 bağımsız incelemesi)

Görev 5'in (F-25, F-29, F-27'nin atma kısmı) bağımsız incelemesinde kritik ya da önemli bulgu çıkmadı. Bu maddeler bu yüzden ertelendi:

- **Düzeltilen:** İncelemedeki M2 (arka plan sekmesinde tek başarısız yenilemenin bağlantıyı düşürmesi) önemli olarak yeniden derecelendirildi ve Görev 5 içinde düzeltildi.
- **Yeni madde açılmayanlar:** M1 F-27'ye, M4 (belgelenen dinleme süresi) F-25'in kapanış notuna işlendi.

### F-33: `auth:refresh` sürerken socket koparsa yeniden doğrulama zamanlayıcısı tekrar kuruluyor
- **Yer:** `lib/socket/server.ts` (`auth:refresh` → `armReauth()`)
- **Kanıt:** `profileIdFromToken` beklenirken socket koparsa, `disconnect` dinleyicisi zamanlayıcıyı zaten temizlemiş oluyor. Ardından `armReauth()` yeni bir 180 saniyelik zamanlayıcı kuruyor.
- **Etki:** Socket nesnesi bu süre boyunca bellekte kalıyor; süre dolunca `disconnect(true)` boşa çalışıyor. Bağlantılar sık kurulup koptukça artık zamanlayıcılar birikiyor.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 12 (aynı handler'a hız sınırı eklenecek). `armReauth()` öncesine `if (!socket.connected) return;` eklenmeli ve bu yarış için test yazılmalı.

### F-34: `auth:refresh` için hız sınırı yok
- **Yer:** `lib/socket/server.ts` (`auth:refresh`)
- **Kanıt:** Bağlı bir istemci olayı sınırsız gönderebiliyor.
  - Her geçerli token bir `profile.findUnique` sorgusu çalıştırıyor.
  - Bilinmeyen `kid` taşıyan bir token, `@clerk/backend` JWKS önbelleğini atlayıp Clerk Backend API'ye istek yaptırıyor.
- **Etki:** Veritabanı yükü; uygulamanın Clerk API hız limitinin tüketilmesi. Aynı yüzey handshake'te ve `chat:join`'de (F-28) zaten var; bu olay, yeniden bağlanma maliyeti olmadan çalışan sınırsız bir yol ekliyor.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 12 (F-28 ile birlikte). Socket başına sınır konmalı (ör. 10 saniyede 1 yenileme; fazlası yok sayılır).

### F-35: Atma/ayrılmada silinen özel sohbetin karşı tarafı odada kalıyor
- **Yer:** `app/api/members/[memberId]/route.ts` (DELETE), `app/api/servers/[serverId]/leave/route.ts`
- **Kanıt:** `Member` silinince `Conversation` cascade ile siliniyor, ama `leaveServerRooms` yalnızca atılan ya da ayrılan profilin socket'lerini çıkarıyor. Karşı tarafın socket'leri artık var olmayan sohbetin odasında kalıyor.
- **Etki:** F-29 ile aynı: bellekte gereksiz oda üyeliği, veri sızıntısı yok.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 9 (özel sohbet akışları) ya da Görev 12. Özel sohbet ID'leri için ayrıca `closeChatRooms` çağrılmalı.

### F-36: `getOwnedServerChatIds` tüm üye ID'lerini `$in` listesiyle sorguluyor
- **Yer:** `lib/auth/access.ts` (`getOwnedServerChatIds`)
- **Kanıt:** Sunucunun tüm üye ID'leri belleğe alınıp büyük bir `$in` listesiyle `conversation.findMany` çalıştırılıyor.
- **Etki:** Silme işlemi nadir olduğundan düşük; çok büyük sunucuda yavaş sorgu.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 15 (indeksler). Bir sohbetin iki üyesi aynı sunucuda olduğundan `where: { memberOne: { serverId } }` yeterli. Bunun Prisma/Mongo'da ilişki filtresi olarak verimli çalıştığı doğrulanmalı.

### F-37: `SocketProvider`'da paylaşılan `retry` değişkeni bir zamanlayıcıyı kaçırabiliyor
- **Yer:** `components/ui/providers/socket-provider.tsx` (`disconnect` ve `connect_error` dinleyicileri)
- **Kanıt:** İki dinleyici de aynı `retry` değişkenine yazıyor. İkisi art arda tetiklenirse ilk zamanlayıcının tutamacı kayboluyor ve temizlikte iptal edilmiyor.
- **Etki:** `start` içindeki `cancelled` kontrolü bağlanmayı engellediği için zararı, unmount sonrasında yapılan bir boş `fetch` isteği.
- **Durum:** Kodda doğrulandı.
- **Ele alınacağı görev:** Görev 14 ya da socket istemcisine dokunan ilk görev. Yeni zamanlayıcı kurmadan önce `clearTimeout(retry)` çağrılmalı.

---

## Sonradan eklenenler (Paket 6)

### F-38: Sunucudan atılan, ayrılan ya da kanalı silinen kullanıcı LiveKit odasında kalıyor
- **Yer:** `app/api/members/[memberId]/route.ts` (DELETE), `app/api/servers/[serverId]/leave/route.ts`, `app/api/channels/[channelId]/route.ts` (DELETE), `app/api/servers/[serverId]/route.ts` (DELETE)
- **Kanıt:**
  - LiveKit token'ı yalnızca odaya bağlanırken doğrulanıyor. Bağlı katılımcının token'ını LiveKit sunucusu kendisi yeniliyor; uygulama üyeliğin bittiğini LiveKit'e hiç bildirmiyor (`RoomServiceClient` kullanılmıyor).
  - Görev 6 sonrası: atılmadan önce alınmış ama kullanılmamış bir token en fazla 10 dakika (`TOKEN_TTL`) daha geçerli. Yeni token isteği 403 dönüyor.
- **Etki:** Atılan üye, sayfayı yenileyene ya da bağlantısı kalıcı olarak kopana kadar ses/görüntü odasını dinlemeye ve yayın yapmaya devam edebiliyor. Kullanılmamış token'la 10 dakika içinde yeniden girebiliyor. Kanal silinince LiveKit odası boşalana kadar yaşıyor.
- **Durum:** Kodda doğrulandı (LiveKit davranışı belgeden; elle doğrulama: `docs/elle-test.md` Paket 6, 8. adım).
- **Ek (Paket 6 bağımsız incelemesi):** Bağlı katılımcı ağ kopmasında da geri bağlanabiliyor; livekit-client sunucunun yenilediği token'ı hem resume hem tam yeniden katılmada kullanıyor. Özel sohbette cascade ile silinen sohbetin odasında iki taraf da kalıyor. Yönetici kanal türünü değiştirdiğinde (VIDEO → AUDIO/TEXT, `app/api/channels/[channelId]/route.ts` PATCH) bağlı katılımcılar eski yetkilerini koruyor; bu durumda `updateParticipant` ya da `deleteRoom` çağrılmalı.
- **Ele alınacağı görev:** Yeni bir görev (Görev 5'teki socket tahliyesinin LiveKit karşılığı). Atma ve ayrılmada `RoomServiceClient.removeParticipant(room, profileId)` çağrılmalı (sunucunun AUDIO/VIDEO kanalları ve silinen özel sohbetler için). Kanal ya da sunucu silinince `deleteRoom(room)` çağrılmalı. LiveKit hatası silme işlemini başarısız kılmamalı.

Paket 6'nın bağımsız incelemesinde kritik bulgu çıkmadı. Önemli bulgu (atılan kullanıcı odada kalıyor) F-38 olarak zaten açıktı; incelemenin kanal türü değişikliği notu oraya eklendi. F-03'ün kapanış notundaki "sesli kanalda kamera kapalı" ifadesi garanti gibi okunduğu için düzeltildi. Aşağıdakiler ertelendi:

### F-39: LiveKit odasında görünen ad eşsiz değil
- **Yer:** `app/api/livekit/route.ts` (`name: profile.name`), `lib/get-or-create-profile.ts`
- **Kanıt:** `identity` artık eşsiz (`profile.id`); ama odada yalnızca `name` görünüyor. `profile.name`, ilk girişte kullanıcının Clerk'te seçtiği ad-soyaddan bir kez kopyalanıyor. Soyadı boşsa ad `"Ali null"` gibi oluşuyor (eski kod).
- **Etki:** Biri bilinen birinin ad-soyadını seçip odada onunla aynı adla görünebilir. Birbirini düşürme sorunu kapandı, görsel karışıklık kalıyor.
- **Durum:** İncelemede doğrulandı.
- **Ele alınacağı görev:** Görev 15 (ya da arayüz işi). Katılımcı kutucuğunda profil resmi gösterilmeli; `null` birleştirmesi `get-or-create-profile.ts`'te düzeltilmeli.

### F-40: `MediaRoom` token hatasında yeniden deneme sunmuyor
- **Yer:** `components/media-room.tsx` (token `useEffect`)
- **Kanıt:** Geçici bir 500 ya da ağ hatası "Odaya bağlanılamadı" mesajını kullanıcı başka sayfaya geçene kadar ekranda bırakıyor. Clerk middleware'i oturumsuz API isteğini route'tan önce 404 ile reddederse kullanıcı erişim mesajı yerine bu genel mesajı görüyor.
- **Etki:** Kullanıcı deneyimi; güvenlik etkisi yok.
- **Durum:** İncelemede doğrulandı.
- **Ele alınacağı görev:** Görev 11 (hata kodları) ya da Görev 13. Bir "Tekrar dene" butonu, effect bağımlılığındaki bir sayacı artırmalı.

### F-41: Paket 6 testlerinde iki boşluk
- **Yer:** `tests/app/api/livekit.test.ts`, `tests/components/media-room.test.tsx`
- **Kanıt:**
  - Sohbet oda adı testinde sorgu değeri ile `conversation.id` aynı. Sohbet dalı `room: chatId` olsa da test geçer. Kanal testindeki büyük/küçük harf yöntemi burada da kullanılmalı.
  - `VideoConference2`'nin `ControlBar`'a `camera: false` geçirdiği test edilmiyor; yalnızca `canPublishCamera` test ediliyor.
  - Eski token testi `resp.json()`'un `setTimeout(0)`'dan önce bitmesine dayanıyor (bugün kararlı).
  - "Clerk adı olmasa da token ister" testi yalnızca gerilemeye karşı koruma; `useUser` artık kullanılmıyor.
- **Etki:** İleride bir gerileme fark edilmeyebilir. Bugünkü kod doğru (incelemede elle okundu).
- **Durum:** İncelemede doğrulandı.
- **Ele alınacağı görev:** LiveKit'e dokunan bir sonraki görev (F-38).
