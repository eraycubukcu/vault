# Vault Chat Düzeltme Planı

> **Yapay zekâ ajanları için:** Bu planı görev görev uygulamak için superpowers:subagent-driven-development (önerilen) veya superpowers:executing-plans kullanılmalı. Adımlar `- [ ]` onay kutusu biçiminde takip edilir.

**Amaç:** `docs/findings.md` içindeki F-01…F-20 bulgularını kapatmak. Önce veri sızıntılarını kapatmak, sonra bozuk özellikleri onarmak, en son sağlamlık ve bakım işlerini yapmak.

**Mimari:**
- Yetki kontrolleri tek bir modülde (`lib/auth/access.ts`) toplanıyor ve hem HTTP route'ları hem de Socket.IO bu modülü kullanıyor.
- Socket.IO, el sıkışma (handshake) sırasında Clerk token'ı ile kimlik doğruluyor. Her sohbet için bir oda (`chat:{id}`) ve her kullanıcı için bir oda (`profile:{id}`) açılıyor.
- Olaylar `io.emit` yerine yalnızca ilgili odaya gönderiliyor (Yaklaşım A).
- `io` örneği `globalThis` üzerinden App Router route'larına da açılıyor.

**Teknoloji:** Next.js 15 (App Router + Pages API), Prisma 5 + MongoDB, Clerk 6, Socket.IO 4, LiveKit, UploadThing 7, zod, Vitest.

**Spec:** `docs/findings.md`. Bağlam olarak `CLAUDE.md` ve `UMLs/*.puml` kullanılıyor.

## Genel Kısıtlar

- Dağıtım ortamı Railway üzerinde tek bir sürekli açık Node.js container. Bu yüzden bellek içi durum (rate limit, Socket.IO odaları) tek örnek varsayımıyla tasarlanıyor. Birden çok örneğe geçilirse Redis adapter ve Redis rate limit gerekecek (bkz. Ek: Yaklaşım B).
- Yetki kontrolü için mevcut desen korunuyor: koşul Prisma `where` içine yazılıyor. Ancak "bulunamadı" sonucu artık 404 olarak dönüyor (Görev 11).
- Başkalarına gönderilen profil verisinde yalnızca `id`, `name` ve `imageUrl` yer alıyor. `email` istemciye hiç gönderilmiyor.
- Mesaj içeriği: kırpılmış (trim) hâli en az 1, en fazla **2000** karakter.
- Sunucu ve kanal adı: kırpılmış hâli 1–100 karakter. Kanal adı `"general"` olamaz.
- `fileUrl` yalnızca `https://utfs.io/` veya `https://<herhangi>.ufs.sh/` ile başlayabilir.
- Arayüz metinleri Türkçe olacak. Silinen mesaj metni: `"Bu mesaj silindi"`.
- Her görev sonunda `npm run lint && npm run typecheck && npm test` komutlarının üçü de geçmeli.

## İnceleme Odağı

Spec'in ima ettiği ama hiçbir görevin ana testinin doğrudan kapsamadığı riskler aşağıda. Her biri için bir test, sahibi olan göreve eklendi.

1. **Ağ kopup socket yeniden bağlandığında** kullanıcı açık sohbetin odasına otomatik olarak yeniden katılmalı ve mesajlar akmaya devam etmeli. Test Görev 5'te.
2. **Sunucudan atılan veya sunucudan ayrılan kullanıcı** açık sekmesinde artık o sunucunun kanal olaylarını almamalı. Test Görev 5'te.
3. **Yalnızca boşluklardan oluşan mesaj veya düzenleme** 400 ile reddedilmeli. Test Görev 10'da.
4. **Eski mesajlar** (`fileType` alanı boş olanlar) yine doğru (resim veya PDF) gösterilmeli. Test Görev 13'te.
5. **Süresi dolmuş push aboneliği** (410 Gone) sessizce silinmeli; mesaj gönderimi bu yüzden başarısız olmamalı. Test Görev 7'de.

---

## Dosya Yapısı

| Dosya | Sorumluluk | Görev |
|---|---|---|
| `vitest.config.ts`, `tests/setup.ts` | Test altyapısı, `@/` alias'ı | 1 |
| `.github/workflows/ci.yml` | Lint, typecheck ve test | 1 |
| `lib/current-profile.ts` | Salt okunur profil getirme (App Router) | 2 |
| `lib/get-or-create-profile.ts` | Profil oluşturma (yalnızca setup sayfası). `inital-profile.ts` yerine geçer | 2 |
| `lib/public-profile.ts` | `publicProfileSelect`, `messageInclude` | 2 |
| `lib/auth/access.ts` | Kanal, sohbet ve oda erişim kontrolleri | 3 |
| `lib/socket/server.ts` | `getIO()`, `emitToChat()`, `leaveServerRooms()` | 4 |
| `lib/socket/auth.ts` | Socket handshake middleware'i | 4 |
| `prisma/schema.prisma` | `PushSubscription` modeli, `fileType`, indeksler, `messageID` alanının kaldırılması | 7, 13, 15 |
| `lib/push.ts` | DM bildirimi gönderimi | 7 |
| `lib/validation.ts` | Tüm zod şemaları | 10 |
| `lib/api-error.ts` | Prisma hatalarını HTTP yanıtına eşleme | 11 |
| `lib/rate-limit.ts` | Bellek içi kayan pencere (sliding window) | 12 |
| `lib/message-display.ts` | `isEdited`, `getFileKind` | 13 |

Testler `tests/` klasöründe, kaynak dosyalarla aynı yol yapısında duruyor. Örnek: `tests/lib/auth/access.test.ts`.

Mock kuralı: `@/lib/db` modülü `vi.mock` ile sahte bir Prisma nesnesine çevrilir; `currentProfile` ve `currentProfilePages` da mock'lanır. Gerçek veritabanı kullanılmaz.

---

# Faz 0: Güvenlik Ağı

### Görev 1: Test, tip denetimi ve CI altyapısı (F-16)

**Dosyalar:**
- Oluştur: `vitest.config.ts`, `tests/setup.ts`, `tests/smoke.test.ts`, `.github/workflows/ci.yml`
- Değiştir: `package.json` (scripts, devDependencies), `.eslintrc.json`, `app/(setup)/page.tsx:14`

**Arayüzler:**
- Üretir: `npm test` (`vitest run`), `npm run typecheck` (`tsc --noEmit`). `tests/setup.ts` jsdom ortamını ve `@testing-library/jest-dom` eşleştiricilerini yükler.

- [ ] **Adım 1:** Geliştirme bağımlılıklarını ekle: `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`. Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"typecheck": "tsc --noEmit"`.
- [ ] **Adım 2:** `vitest.config.ts` yaz: `tsconfigPaths()` ve `react()` plugin'leri, `environment: "jsdom"`, `setupFiles: ["tests/setup.ts"]`, `include: ["tests/**/*.test.{ts,tsx}"]`.
- [ ] **Adım 3:** `tests/smoke.test.ts` içinde `cn("a", false && "b") === "a"` testini yaz. Çalıştır: `npm test` → Beklenen: 1 passed.
- [ ] **Adım 4:** `app/(setup)/page.tsx:14` içindeki `@ts-ignore` satırını kaldır ve tip hatasını gider (profil `null` olamaz; `initialProfile` yönlendirme yapar). Çalıştır: `npm run typecheck` → Beklenen: hata yok. Hata çıkarsa önce onu düzelt, düzeltilen dosyayı commit mesajında belirt.
- [ ] **Adım 5:** `.eslintrc.json` içinde şu kuralları yeniden aç: `"prefer-const": "error"`, `"react-hooks/exhaustive-deps": "warn"`, `"@typescript-eslint/ban-ts-comment": "error"`. Çalıştır: `npm run lint` → Beklenen: 0 hata (uyarılar kabul edilebilir).
- [ ] **Adım 6:** `.github/workflows/ci.yml` yaz: `push` ve `pull_request` olaylarında; Node 22; `npm ci` → `npx prisma generate` → `npm run lint` → `npm run typecheck` → `npm test`.
- [ ] **Adım 7:** Commit: `chore: add vitest, typecheck and CI`

---

# Faz 1: Kritik Güvenlik

### Görev 2: Profil erişiminin ayrılması ve e-postanın gizlenmesi (F-12, F-02 ek)

**Dosyalar:**
- Değiştir: `lib/current-profile.ts`, `app/(setup)/page.tsx`, profil gösteren tüm `include: { profile: true }` kullanımları (`pages/api/socket/**`, `app/api/messages`, `app/api/direct-messages`, `app/api/members`, `lib/conversation.ts`)
- Oluştur: `lib/get-or-create-profile.ts`, `lib/public-profile.ts`
- Sil: `lib/inital-profile.ts`
- Test: `tests/lib/current-profile.test.ts`

**Arayüzler:**
- Üretir:
  - `currentProfile(): Promise<Profile | null>`: yalnızca okur; hiçbir koşulda yazmaz ve yönlendirme yapmaz.
  - `getOrCreateProfile(): Promise<Profile>`: oturum yoksa `redirect("/home")`, profil yoksa oluşturur.
  - `publicProfileSelect = { id: true, name: true, imageUrl: true } as const`
  - `messageInclude = { member: { include: { profile: { select: publicProfileSelect } } } } as const`

- [ ] **Adım 1:** Test yaz. `currentProfile` testleri:
  - `auth()` `userId: null` döndürürse → `null`.
  - Profil bulunamazsa → `null` ve `db.profile.create` hiç çağrılmamış.
  - Profil bulunursa → o profil.

  Elle doğrulanacak senaryo (Adım 5'te): yeni bir hesapla doğrudan bir davet linkini açınca profil oluşturulmalı ve kullanıcı sunucuya katılmalı.
- [ ] **Adım 2:** `npm test -- current-profile` → Beklenen: "profil yoksa null" testi FAIL.
- [ ] **Adım 3:** `lib/current-profile.ts` dosyasındaki `initialProfile()` çağrısını kaldır, yerine `return profile ?? null` koy. `lib/inital-profile.ts` dosyasını `lib/get-or-create-profile.ts` adıyla `getOrCreateProfile` olarak taşı. Yeni fonksiyonu iki giriş noktası kullansın: `app/(setup)/page.tsx` ve `app/(invite)/(routes)/invite/[inviteCode]/page.tsx`. Davet linkiyle ilk kez gelen kullanıcının henüz profili olmadığı için davet sayfası `currentProfile` kullanmamalı.
- [ ] **Adım 4:** `lib/public-profile.ts` dosyasını oluştur. Mesaj ve üye döndüren tüm sorgularda `include: { profile: true }` yerine `profile: { select: publicProfileSelect }` kullan. Arama komutu: `grep -rn "profile: *true" app pages lib` → bu değişiklikten sonra yalnızca, istemciye gönderilmeyen sunucu tarafı kullanımlar kalmalı.
- [ ] **Adım 5:** `npm test && npm run typecheck` → PASS.
- [ ] **Adım 6:** Commit: `fix: make currentProfile read-only and stop leaking emails`

### Görev 3: Erişim yardımcıları ve mesaj geçmişi API'leri (F-01)

**Dosyalar:**
- Oluştur: `lib/auth/access.ts`
- Değiştir: `app/api/messages/route.ts`, `app/api/direct-messages/route.ts`
- Test: `tests/lib/auth/access.test.ts`, `tests/app/api/messages.test.ts`, `tests/app/api/direct-messages.test.ts`

**Arayüzler:**
- Tüketir: `currentProfile` ve `messageInclude` (Görev 2).
- Üretir:
  - `getChannelAccess(profileId: string, channelId: string): Promise<{ channel: Channel; member: Member } | null>`: kanalın sunucusunda bu profile ait bir üyelik varsa döner.
  - `getConversationAccess(profileId: string, conversationId: string): Promise<{ conversation: Conversation; member: Member } | null>`: profil `memberOne` veya `memberTwo` ise döner; `member` profilin kendi üyeliğidir.
  - `canAccessChat(profileId: string, chatId: string): Promise<boolean>`: `chatId` bir kanal ya da sohbet olabilir.

- [ ] **Adım 1:** `access.test.ts` testlerini yaz:
  - `getChannelAccess`: üye değilse `null`; üyeyse `{ channel, member }`; kanal yoksa `null`.
  - `getConversationAccess`: üçüncü bir kişi için `null`; iki taraf için de dolu sonuç.
  - `canAccessChat`: kanal veya sohbetten biri erişilebilirse `true`, hiçbiri değilse `false`.
- [ ] **Adım 2:** Route testlerini yaz:
  - `GET /api/messages?channelId=X` üye olmayan biri için → 403 ve `db.message.findMany` çağrılmamış.
  - Üye için → 200, `{ items, nextCursor }`.
  - Aynı iki test `direct-messages` için de yazılır.
- [ ] **Adım 3:** `npm test` → Beklenen: route testleri FAIL (şu an 200 dönüyor).
- [ ] **Adım 4:** `lib/auth/access.ts` dosyasını yaz. İki route da `findMany` öncesinde ilgili erişim fonksiyonunu çağırsın; sonuç `null` ise `new NextResponse("Forbidden", { status: 403 })` dönsün. `include` yerine `messageInclude` kullanılsın.
- [ ] **Adım 5:** `npm test` → PASS.
- [ ] **Adım 6:** Commit: `fix: require membership to read message history`

### Görev 4: Socket.IO sunucusu: kimlik doğrulama ve odalar (F-02, sunucu tarafı)

**Dosyalar:**
- Oluştur: `lib/socket/server.ts`, `lib/socket/auth.ts`
- Değiştir: `pages/api/socket/io.ts`, dört `pages/api/socket/**` handler'ı (`emit` satırları: `messages/index.ts:81`, `messages/[messageId].ts:130`, `direct-messages/index.ts:86`, `direct-messages/[directMessageId].ts:132`)
- Test: `tests/lib/socket/auth.test.ts`, `tests/lib/socket/server.test.ts`, `tests/pages/api/socket/messages.test.ts`

**Arayüzler:**
- Tüketir: `canAccessChat` (Görev 3).
- Üretir:
  - `authenticateSocket(socket: Socket, next: (err?: Error) => void): Promise<void>`: `socket.handshake.auth.token` değerini `verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })` (`@clerk/nextjs/server`) ile doğrular. `payload.sub` değerinden profili bulur ve `socket.data.profileId` alanına yazar. Başarısız olursa `next(new Error("unauthorized"))` çağırır.
  - `registerSocketHandlers(io: Server): void`: bağlantı kurulunca `socket.join("profile:" + profileId)` çalıştırır.
    - `"chat:join"` olayı: `(chatId: string, ack: (r: { ok: boolean }) => void)`. `canAccessChat` doğruysa `socket.join("chat:" + chatId)`.
    - `"chat:leave"` olayı: `(chatId: string)`.
  - `getIO(): Server | undefined`: `globalThis.__vaultIO` değerini okur. `io.ts` örneği oluşturduğunda buraya yazar.
  - `emitToChat(chatId: string, event: string, payload: unknown): void`: `getIO()?.to("chat:" + chatId).emit(event, payload)`.
  - `leaveServerRooms(profileId: string, chatIds: string[]): void`: `getIO()?.in("profile:" + profileId).socketsLeave(chatIds.map(id => "chat:" + id))`.
  - Olay adları değişmiyor: `chat:{id}:messages`, `chat:{id}:messages:update`.

- [ ] **Adım 1:** `auth.test.ts` testlerini yaz (`verifyToken` mock'lanır):
  - Token yok → `next` bir `Error("unauthorized")` ile çağrılmış.
  - Token geçersiz → aynı sonuç.
  - Geçerli token var ama profil yok → aynı sonuç.
  - Geçerli → `socket.data.profileId === "p1"` ve `next()` argümansız çağrılmış.
- [ ] **Adım 2:** `server.test.ts` testlerini yaz (sahte `io` ve `socket` nesneleriyle):
  - `chat:join`: `canAccessChat` false → `join` çağrılmamış ve `ack({ ok: false })`; true → `join("chat:c1")` ve `ack({ ok: true })`.
  - `emitToChat("c1", "e", x)` → `io.to("chat:c1").emit("e", x)` çağrılmış ve `io.emit` hiç çağrılmamış.
- [ ] **Adım 3:** `messages.test.ts` testini yaz: POST başarılı olduğunda `emitToChat(channelId, "chat:{channelId}:messages", message)` çağrılmış.
- [ ] **Adım 4:** `npm test` → FAIL.
- [ ] **Adım 5:** İki modülü yaz. `io.ts` içinde `io.use(authenticateSocket)` ve `registerSocketHandlers(io)` çağrılsın, `globalThis.__vaultIO = io` atansın. Dört handler'daki `res.socket.server.io.emit` çağrıları `emitToChat` ile değiştirilsin.
- [ ] **Adım 6:** `npm test` → PASS.
- [ ] **Adım 7:** Commit: `fix: authenticate sockets and scope events to chat rooms`

### Görev 5: Socket istemcisi, odaya katılma ve üyelik bitince odadan çıkarma (F-02, istemci tarafı)

**Dosyalar:**
- Değiştir: `components/ui/providers/socket-provider.tsx:30`, `hooks/use-chat-socket.ts`, `app/api/members/[memberId]/route.ts` (DELETE), `app/api/servers/[serverId]/leave/route.ts`, `app/api/channels/[channelId]/route.ts` (DELETE)
- Test: `tests/hooks/use-chat-socket.test.tsx`, `tests/app/api/members.test.ts`

**Arayüzler:**
- Tüketir: `"chat:join"`, `"chat:leave"` ve `leaveServerRooms` (Görev 4).
- Üretir: `useChatSocket({ chatId, queryKey, addKey, updateKey })`. Mevcut imzaya `chatId: string` ekleniyor; `ChatMessages` bu değeri geçirecek.

- [ ] **Adım 1:** Hook testlerini yaz (sahte socket ile):
  - Mount olunca `emit("chat:join", "c1", fn)` çağrılmış.
  - Unmount olunca `emit("chat:leave", "c1")` çağrılmış.
  - **İnceleme Odağı 1:** sahte socket `"connect"` olayını ikinci kez tetiklediğinde `chat:join` yeniden gönderilmiş.
- [ ] **Adım 2:** **İnceleme Odağı 2** testini yaz: `DELETE /api/members/m1?serverId=s1` başarılı olduğunda, atılan üyenin `profileId` değeri ve sunucunun tüm kanal ID'leriyle `leaveServerRooms` çağrılmış. `leave` route'u için de aynı test.
- [ ] **Adım 3:** `npm test` → FAIL.
- [ ] **Adım 4:** `SocketProvider` `useAuth().getToken` kullansın ve `ClientIO(url, { path, addTrailingSlash: false, auth: (cb) => getToken().then(token => cb({ token })) })` ile bağlansın. Bu yapıda her yeniden bağlanmada taze bir token alınır. `useChatSocket` hem mount olunca hem `"connect"` olayında `chat:join` göndersin; temizlikte `chat:leave` göndersin ve `socket.off(event, handler)` ile yalnızca kendi dinleyicilerini kaldırsın. Route'lar silme veya güncellemeden **önce** etkilenen `profileId` ve kanal ID'lerini okusun; işlem başarılı olunca `leaveServerRooms` çağırsın. Kanal silindiğinde `getIO()?.in("chat:" + channelId).socketsLeave("chat:" + channelId)` çağrılsın.
- [ ] **Adım 5:** `npm test` → PASS. Elle doğrulama: iki tarayıcı açıp B kullanıcısını sunucudan at. B'nin açık sekmesine artık yeni kanal mesajı gelmemeli. Konsolda `socket.onAny(console.log)` çalıştırınca yalnızca katılınan sohbetin olayları görünmeli.
- [ ] **Adım 6:** Commit: `fix: join chat rooms from client and evict removed members`

### Görev 6: LiveKit token'ı (F-03)

**Dosyalar:**
- Değiştir: `app/api/livekit/route.ts`, `components/media-room.tsx:160-170`
- Test: `tests/app/api/livekit.test.ts`

**Arayüzler:**
- Tüketir: `currentProfile`, `canAccessChat`.
- Üretir: `GET /api/livekit?room={chatId}` → `{ token }`. `username` parametresi kaldırılıyor. Token'da `identity = profile.id`, `name = profile.name`.

- [ ] **Adım 1:** Testleri yaz:
  - Profil yok → 401.
  - `canAccessChat` false → 403.
  - Geçerli → 200; `AccessToken` `{ identity: "p1", name: "Ad Soyad" }` ile oluşturulmuş.
  - Gelen `username` parametresi dikkate alınmıyor.
- [ ] **Adım 2:** `npm test -- livekit` → FAIL.
- [ ] **Adım 3:** Route'u değiştir. `MediaRoom` artık yalnızca `room` göndersin; `useUser` bağımlılığı kalkıyor ve token alınan `useEffect` yalnızca `chatId`'ye bağlı oluyor.
- [ ] **Adım 4:** `npm test` → PASS. Elle doğrulama: aynı ada sahip iki hesap aynı odaya katılabilmeli ve birbirini düşürmemeli.
- [ ] **Adım 5:** Commit: `fix: authorize LiveKit tokens and derive identity server-side`

### Görev 7: Push bildirimlerinin güvenli ve çalışır hale getirilmesi (F-04, F-06)

**Karar:** Kapsam yalnızca **özel mesaj bildirimleri**. Alıcı çevrimdışıyken yeni bir özel mesaj gelirse bildirim gönderilir. Kanal bildirimleri bu planın kapsamında değil.

**Dosyalar:**
- Değiştir: `prisma/schema.prisma`, `app/actions.ts`, `pages/api/socket/direct-messages/index.ts`, `public/sw.js`, `components/modals/initial-modal.tsx` (ölü push kodu siliniyor)
- Oluştur: `lib/push.ts`, `components/push-toggle.tsx` (kullanıcı menüsünde abone ol/çık düğmesi; `NavigationSideBar` alt kısmına eklenir)
- Test: `tests/app/actions.test.ts`, `tests/lib/push.test.ts`

**Arayüzler:**
- Üretir:
  - Prisma modeli: `PushSubscription { id String @id @default(uuid()) @map("_id"); profileId String; profile Profile @relation(...onDelete: Cascade); endpoint String @unique; p256dh String; auth String; createdAt DateTime @default(now()); @@index([profileId]) }`. `Profile` modeline `pushSubscriptions PushSubscription[]` eklenir.
  - `subscribeUser(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ success: boolean }>`: `currentProfile` zorunlu; `endpoint` üzerinden upsert.
  - `unsubscribeUser(endpoint: string): Promise<{ success: boolean }>`: yalnızca kendi kaydını silebilir.
  - `sendNotification` server action'ı **siliniyor**.
  - `notifyProfile(profileId: string, payload: { title: string; body: string; url: string }): Promise<void>` (`lib/push.ts`, `"server-only"`): profilin tüm aboneliklerine gönderir. 404 veya 410 dönen aboneliği siler, diğer hataları loglar; asla hata fırlatmaz.
  - VAPID iletişim adresi: `process.env.VAPID_SUBJECT`. Bu ortam değişkeni yeni ve `.env.example`'a ekleniyor (Görev 15).

- [ ] **Adım 1:** `actions.test.ts` testlerini yaz:
  - Oturum yok → `subscribeUser` `{ success: false }` dönmüş ve veritabanına dokunulmamış.
  - Aynı `endpoint` ile iki kez çağrılınca `upsert` çağrılmış.
  - `unsubscribeUser`, başka bir profilin `endpoint`'i için `deleteMany({ where: { endpoint, profileId } })` çalıştırmış ve 0 kayıt silinmiş.
- [ ] **Adım 2:** `push.test.ts` testlerini yaz:
  - **İnceleme Odağı 5:** `webpush.sendNotification` 410 hatası fırlatınca o abonelik silinmiş ve `notifyProfile` resolve olmuş.
  - Başarılı gönderimde payload `JSON.stringify({ title, body, url })` olarak gönderilmiş.
- [ ] **Adım 3:** `npm test` → FAIL.
- [ ] **Adım 4:** Modeli ekle ve `npx prisma generate` ile `npx prisma db push` çalıştır. `actions.ts` ve `lib/push.ts` dosyalarını yaz. İstemci tarafı aboneliği `sub.toJSON()` ile gönderilsin; `TextDecoder` kullanımı kaldırılsın. Özel mesaj POST'u, mesaj kaydedildikten sonra alıcı için `notifyProfile(otherMember.profileId, { title: sender.name, body: content.slice(0, 120), url: "/servers/{serverId}/conversations/{senderMemberId}" })` çağırsın. Bu çağrı `await` edilmeden, `.catch` ile loglanarak yapılsın. `sw.js` içinde `openWindow(event.notification.data.url)` kullanılsın; olmayan `/badge.png` referansı kaldırılsın.
- [ ] **Adım 5:** `npm test` → PASS. Elle doğrulama (`npm run dev2`, HTTPS): abone ol, ikinci hesaptan özel mesaj gönder, bildirim gelsin ve tıklanınca doğru sohbet açılsın.
- [ ] **Adım 6:** Commit: `feat: per-user push subscriptions with DM notifications`

---

# Faz 2: Çalışmayan Özellikler

### Görev 8: Sohbet sorgusu ve sayfalama (F-05)

**Dosyalar:**
- Değiştir: `hooks/use-chat-query.ts`, `components/chat/chat-messages.tsx:50-72`
- Test: `tests/hooks/use-chat-query.test.tsx`, `tests/components/chat/chat-messages.test.tsx`

**Arayüzler:**
- Üretir: `useChatQuery(props: ChatQueryProps)`. Artık **senkron** bir hook ve `useInfiniteQuery` sonucunu (`data`, `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, `status`) doğrudan döndürüyor. `refetchInterval` socket bağlıyken `false`, değilken `5000` (`useSocket().isConnected`).

- [ ] **Adım 1:** Hook testini yaz (`renderHook` + `QueryClientProvider` + sahte `fetch`): ilk sayfa `{ items: [10 öğe], nextCursor: "m10" }` gelince `hasNextPage === true` olmalı; `fetchNextPage()` çağrısı `cursor=m10` ile istek atmalı.
- [ ] **Adım 2:** Bileşen testini yaz: `hasNextPage` true iken "Önceki mesajları yükle" düğmesi görünmeli ve `ChatWelcome` görünmemeli.
- [ ] **Adım 3:** `npm test` → FAIL.
- [ ] **Adım 4:** Hook'tan `async` kaldırılsın. `ChatMessages` içindeki `useState`, `.then` ve `let` değişkenleri silinsin; değerler hook'tan doğrudan alınsın. `useChatSocket`'a `chatId` geçirilsin (Görev 5).
- [ ] **Adım 5:** `npm test` → PASS. Elle doğrulama: 25 mesajlık bir kanalda yukarı kaydırınca eski mesajlar yüklenmeli.
- [ ] **Adım 6:** Commit: `fix: make useChatQuery a real hook and restore pagination`

### Görev 9: Yönlendirmeler, özel sohbet hedefi ve özel mesaj silme yetkisi (F-07, F-08, F-09)

**Dosyalar:**
- Değiştir: `RedirectToSignIn` kullanılan dört dosya (findings F-07 bölümünde listeli), `lib/conversation.ts`, `app/(main)/(routes)/servers/[serverId]/conversations/[memberId]/page.tsx:47`, `pages/api/socket/direct-messages/[directMessageId].ts:81-83`
- Test: `tests/lib/conversation.test.ts`, `tests/pages/api/socket/direct-message-id.test.ts`

**Arayüzler:**
- Üretir: `getOrCreateConversation(memberOneId: string, memberTwoId: string): Promise<ConversationWithMembers | null>`. İki ID aynıysa ya da iki üyenin `serverId` değeri farklıysa (veya biri yoksa) `null` döner.

- [ ] **Adım 1:** `conversation.test.ts` testlerini yaz:
  - Aynı ID → `null` ve `create` çağrılmamış.
  - Farklı sunucular → `null`.
  - Ters sırada var olan sohbet → mevcut sohbet dönmüş.
- [ ] **Adım 2:** Özel mesaj silme testini yaz: sunucuda ADMIN olan bir üye, sohbetteki karşı tarafın mesajını silmeye çalışırsa → 403 ve `update` çağrılmamış. Sahibi silerse → 200.
- [ ] **Adım 3:** `npm test` → FAIL.
- [ ] **Adım 4:** `getOrCreateConversation` içine üye doğrulamasını ekle. Özel mesaj handler'ında `canModify = isMessageOwner` olsun; yetkisiz durumda 403 dönsün. Dört sayfada `return RedirectToSignIn` yerine `redirect("/")` (`next/navigation`) yazılsın. Bu noktada oturum zaten middleware tarafından garanti ediliyor; profil eksikse onu setup sayfası oluşturur. `/sign-in`'e yönlendirmek, oturumu olan ama profili olmayan kullanıcıyı döngüye sokardı.
- [ ] **Adım 5:** `npm test` → PASS.
- [ ] **Adım 6:** Commit: `fix: validate DM targets, owner-only DM deletion, working redirects`

---

# Faz 3: Sağlamlık

### Görev 10: Girdi doğrulaması (F-10)

**Dosyalar:**
- Oluştur: `lib/validation.ts`
- Değiştir: dört `pages/api/socket/**` handler'ı, `app/api/servers/route.ts`, `app/api/servers/[serverId]/route.ts`, `app/api/channels/route.ts`, `app/api/channels/[channelId]/route.ts`, `app/api/members/[memberId]/route.ts`, `next.config.ts` (Görev 14 ile birlikte `*.ufs.sh`)
- Test: `tests/lib/validation.test.ts`, mevcut route testlerine 400 vakaları

**Arayüzler:**
- Üretir:
  - `fileUrlSchema`: `z.string().url()` ve `^https://(utfs\.io|[a-z0-9-]+\.ufs\.sh)/` desenine uymalı.
  - `messageCreateSchema = z.object({ content: z.string().trim().min(1).max(2000), fileUrl: fileUrlSchema.optional(), fileType: z.string().max(100).optional() })`
  - `messageUpdateSchema = z.object({ content: z.string().trim().min(1).max(2000) })`
  - `serverSchema = z.object({ name: z.string().trim().min(1).max(100), imageUrl: fileUrlSchema })`
  - `channelSchema = z.object({ name: z.string().trim().min(1).max(100).refine(n => n.toLowerCase() !== "general"), type: z.nativeEnum(ChannelType) })`
  - `memberRoleSchema = z.object({ role: z.enum(["GUEST", "MODERATOR"]) })`. ADMIN rolüne terfi bu API ile yapılamaz.
  - Tüm route'larda ortak davranış: `safeParse` başarısızsa → 400 ve `{ error: issues[0].message }`.

- [ ] **Adım 1:** `validation.test.ts` testlerini yaz:
  - **İnceleme Odağı 3:** `"   "` reddedilir.
  - 2001 karakter reddedilir; 2000 karakter kabul edilir.
  - `https://evil.com/x.png` reddedilir; `https://abc.ufs.sh/f/k` kabul edilir.
  - `"General"` kanal adı reddedilir.
  - `role: "ADMIN"` reddedilir.
- [ ] **Adım 2:** Route testlerine şunu ekle: geçersiz gövde → 400 ve `db` metotları çağrılmamış. Mesaj POST, mesaj PATCH, kanal POST ve üye PATCH için birer vaka.
- [ ] **Adım 3:** `npm test` → FAIL.
- [ ] **Adım 4:** Şemaları yaz ve her route'ta gövde okunduktan hemen sonra `safeParse` uygula. Veritabanına giden değerler parse edilmiş (`trim` uygulanmış) veriden alınsın.
- [ ] **Adım 5:** `npm test` → PASS.
- [ ] **Adım 6:** Commit: `fix: validate all request bodies with zod`

### Görev 11: Prisma "bulunamadı" hatalarının 404'e eşlenmesi (F-11)

**Dosyalar:**
- Oluştur: `lib/api-error.ts`
- Değiştir: `app/api/servers/[serverId]/route.ts`, `.../invite-code/route.ts`, `.../leave/route.ts`, `app/api/channels/route.ts`, `app/api/channels/[channelId]/route.ts`, `app/api/members/[memberId]/route.ts`, `app/(invite)/(routes)/invite/[inviteCode]/page.tsx:38`
- Test: `tests/lib/api-error.test.ts`

**Arayüzler:**
- Üretir: `toErrorResponse(error: unknown, tag: string): NextResponse`. `Prisma.PrismaClientKnownRequestError` ve `code === "P2025"` ise → 404 `"Not found"`; diğer durumlarda `console.error(tag, error)` ve 500.

- [ ] **Adım 1:** Testleri yaz: P2025 → 404; başka bir Prisma kodu → 500; düz `Error` → 500.
- [ ] **Adım 2:** `npm test -- api-error` → FAIL.
- [ ] **Adım 3:** Fonksiyonu yaz. Listelenen route'ların `catch` bloğu `return toErrorResponse(error, "[TAG]")` olsun. Davet sayfası önce `db.server.findUnique({ where: { inviteCode } })` çalıştırsın; sonuç yoksa `redirect("/")`, varsa `update` yapsın.
- [ ] **Adım 4:** `npm test` → PASS. Elle doğrulama: `/invite/gecersiz` adresi ana sayfaya yönlendirmeli.
- [ ] **Adım 5:** Commit: `fix: return 404 instead of 500 when records are missing`

### Görev 12: Hız sınırlama (F-13)

**Dosyalar:**
- Oluştur: `lib/rate-limit.ts`
- Değiştir: `pages/api/socket/messages/index.ts`, `pages/api/socket/direct-messages/index.ts`, `app/api/servers/route.ts`, `app/api/servers/[serverId]/invite-code/route.ts`, `app/api/livekit/route.ts`
- Test: `tests/lib/rate-limit.test.ts`

**Arayüzler:**
- Üretir: `rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number }`. Bellek içi kayan pencere kullanır; anahtar sayısı 10.000'i aşarsa en eski anahtarlar silinir.
- Limitler (anahtar `"{işlem}:{profileId}"`):

| İşlem | Limit |
|---|---|
| Mesaj ve özel mesaj gönderme | 10 / 10 sn |
| Sunucu oluşturma | 5 / 1 saat |
| Davet kodu yenileme | 10 / 1 saat |
| LiveKit token | 30 / 1 dk |

- Limit aşılınca → 429 ve `Retry-After` başlığı (saniye cinsinden).

- [ ] **Adım 1:** Testleri yaz (`vi.useFakeTimers`): 10. çağrı `ok`, 11. çağrı `ok: false` ve `retryAfterMs > 0`; pencere geçince yeniden `ok`; farklı anahtarlar birbirini etkilemiyor.
- [ ] **Adım 2:** `npm test -- rate-limit` → FAIL.
- [ ] **Adım 3:** Fonksiyonu yaz ve listelenen route'lara, profil doğrulamasının hemen ardından ekle. `ChatInput` 429 aldığında kullanıcıya "Çok hızlı mesaj gönderiyorsunuz" uyarısı gösterilsin.
- [ ] **Adım 4:** `npm test` → PASS.
- [ ] **Adım 5:** Commit: `feat: add in-memory rate limiting to write endpoints`

### Görev 13: Dosya türü ve "(Düzenlendi)" etiketi (F-14, F-15)

**Dosyalar:**
- Değiştir: `prisma/schema.prisma` (`Message` ve `DirectMessage` modellerine `fileType String?`), `components/file-upload.tsx`, `components/modals/message-file-modal.tsx`, `components/chat/chat-item.tsx:121-130`, `components/chat/chat-messages.tsx:121`, iki mesaj POST handler'ı
- Oluştur: `lib/message-display.ts`
- Test: `tests/lib/message-display.test.ts`

**Arayüzler:**
- Üretir:
  - `getFileKind(fileUrl: string | null, fileType: string | null): "image" | "pdf" | null`: önce `fileType`'a bakar (`application/pdf` → pdf, `image/*` → image). `fileType` yoksa URL `.pdf` ile bitiyorsa pdf, değilse image döner.
  - `isEdited(createdAt: string | Date, updatedAt: string | Date): boolean`: iki zaman arasındaki fark 1000 ms'den büyükse true.
  - `FileUpload` bileşeninin `onChange` imzası `(url?: string, type?: string) => void` oluyor; `res[0].type` iletiliyor.

- [ ] **Adım 1:** Önce bulguyu doğrula: bir PDF yükleyip dönen URL'yi incele. URL uzantı içerse bile `fileType` alanı eklenecek, çünkü uzantıya güvenmek kırılgan.
- [ ] **Adım 2:** Testleri yaz:
  - `getFileKind(".../f/abc", "application/pdf")` → `"pdf"`.
  - **İnceleme Odağı 4:** `getFileKind(".../a.pdf", null)` → `"pdf"`; `getFileKind(".../a.png", null)` → `"image"`; `getFileKind(null, null)` → `null`.
  - `isEdited` 3 ms fark için → false; 5 sn fark için → true.
- [ ] **Adım 3:** `npm test -- message-display` → FAIL.
- [ ] **Adım 4:** Fonksiyonları yaz. Şemaya alanı ekleyip `db push` çalıştır. Yükleme modalı `fileType` göndersin; POST handler'ları (Görev 10'daki `messageCreateSchema` ile) bu alanı kaydetsin; `ChatItem` `getFileKind` kullansın; `ChatMessages` `isEdited` kullansın.
- [ ] **Adım 5:** `npm test` → PASS. Elle doğrulama: bir PDF ve bir resim gönderildiğinde ikisi de doğru gösterilmeli; yeni gönderilen bir mesajda "(Düzenlendi)" yazmamalı.
- [ ] **Adım 6:** Commit: `fix: store upload MIME type and robust edited detection`

---

# Faz 4: Bakım

### Görev 14: Bağımlılıklar ve yapılandırma (F-17)

**Dosyalar:** `package.json`, `package-lock.json`, `.npmrc`, `next.config.ts`

- [ ] **Adım 1:** `mongodb`, `mongoose` ve `swiper` paketlerini kaldır: `npm uninstall mongodb mongoose swiper`. Ardından `grep -rn "mongoose\|from \"mongodb\"\|swiper" app components lib hooks pages` → çıktı boş olmalı.
- [ ] **Adım 2:** `eslint-config-next` sürümünü `next` sürümüyle eşitle (15.0.7).
- [ ] **Adım 3:** `next.config.ts` içinde `images.domains` yerine `remotePatterns` kullan: `[{ protocol: "https", hostname: "utfs.io" }, { protocol: "https", hostname: "*.ufs.sh" }, { protocol: "https", hostname: "img.clerk.com" }]`.
- [ ] **Adım 4:** React'i `19.0.0` kararlı sürümüne, `@types/react` ve `@types/react-dom` paketlerini `^19` sürümüne yükselt. `npm install` `.npmrc` olmadan çalışabiliyorsa `.npmrc` dosyasını sil; çakışma sürüyorsa dosyayı tut ve çakışan paketi commit mesajında belirt.
- [ ] **Adım 5:** `npm run lint && npm run typecheck && npm test && npm run build` → hepsi PASS.
- [ ] **Adım 6:** Commit: `chore: prune unused deps, align versions, use remotePatterns`

### Görev 15: Temizlik, dil birliği, dokümantasyon ve indeksler (F-18, F-19, F-20)

**Dosyalar:** `components/modals/initial-modal.tsx`, `app/layout.tsx:35`, `components/chat/chat-messages.tsx:109`, `hooks/use-origin.ts`, `components/chat/chat-item.tsx`, `components/chat/chat-input.tsx`, `components/modals/delete-message-modal.tsx`, iki mesaj `[id]` handler'ı, `prisma/schema.prisma`, `README.md`, `.env.example` (yeni), `CLAUDE.md`, `UMLs/*.puml`

- [ ] **Adım 1:** Ölü kodu temizle:
  - `initial-modal.tsx` içindeki `Page`, `PushNotificationManager` ve `InstallPrompt` bileşenlerini ve `web-push` import'unu sil (push artık Görev 7'deki `push-toggle.tsx` içinde); `window.location.reload()` çağrısını kaldır.
  - `layout.tsx:35` içindeki `manifest()` çağrısını sil.
  - `animate-sping` → `animate-spin`.
  - `use-origin.ts` içindeki effect'e `[]` bağımlılık dizisini ekle.
  - `ChatItem` içindeki ESC dinleyicisi yalnızca `isEditing` true iken eklensin.
- [ ] **Adım 2:** Arayüz dilini birleştir:
  - Silinen mesaj içeriği → `"Bu mesaj silindi"`.
  - `ChatInput` placeholder'ı → `` `${type === "conversation" ? name : "#" + name} kanalına mesaj gönder` ``.
  - Tooltip'ler → "Düzenle" / "Sil".
  - Silme modalı metni → "Mesaj herkes için silinecek".
  - Rol tooltip'leri → "Yönetici" / "Moderatör" / "Misafir".
- [ ] **Adım 3:** Şemayı güncelle:
  - `Message` modeline `@@index([channelId, createdAt])`, `DirectMessage` modeline `@@index([conversationId, createdAt])` ekle.
  - `Message.messageID` alanını kaldır (kodda kullanılmadığını `grep -rn messageID app components lib pages` ile doğrula).
  - Ardından `npx prisma db push`.
- [ ] **Adım 4:** `.env.example` dosyasını yaz: `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `UPLOADTHING_TOKEN`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Gerçek değişken adlarını kullanıcının `.env` dosyasıyla karşılaştırarak doğrula.
- [ ] **Adım 5:** `README.md` dosyasını yeniden yaz: proje tanımı, kurulum (`.env.example` → `.env`, `npm install`, `npx prisma db push`, `npm run dev`), script listesi ve Railway/Docker notu. Bozuk UTF-16 satırını kaldır.
- [ ] **Adım 6:** Belgeleri güncelle:
  - `CLAUDE.md`: Socket oda modeli, `lib/auth/access.ts`, test komutları.
  - `UMLs/09` ve `UMLs/10`: `io.emit` yerine `emitToChat` (oda) akışı.
  - `UMLs/12`: `username` parametresinin kaldırılması.
  - `UMLs/02`: `PushSubscription` modeli ve `fileType` alanı.
- [ ] **Adım 7:** `npm run lint && npm run typecheck && npm test && npm run build` → PASS.
- [ ] **Adım 8:** Commit: `chore: cleanup, Turkish UI copy, docs and indexes`

---

## Kullanıcı Kararı Bekleyen Konular

- **Dockerfile:** Şu an `.gitignore` içinde. Repoya alınırsa dağıtım tekrarlanabilir hale gelir. Karar kullanıcıya ait; bu plan dosyayı değiştirmiyor.
- **Kanal bildirimleri:** Görev 7 yalnızca özel mesajları kapsıyor. Kanal bildirimleri (bahsetme / @mention) ayrı bir özellik olarak planlanabilir.

## Ek: Yaklaşım B (ileride ölçeklenme gerekirse)

Birden fazla container gerektiğinde şu değişiklikler yapılır:
- Socket.IO ayrı bir `server.ts` özel sunucusuna taşınır ve `@socket.io/redis-adapter` eklenir.
- `lib/rate-limit.ts` Redis tabanlı bir uygulamayla değiştirilir.
- `getIO()` ve `emitToChat()` imzaları aynı kalır; bu sayede çağıran kodlar değişmez.
