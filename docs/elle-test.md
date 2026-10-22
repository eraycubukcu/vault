# Elle Doğrulama Listeleri

Otomatik testlerin kapsamadığı, canlı Clerk + MongoDB (ve gerektiğinde ikinci bir cihaz) isteyen senaryolar. Her paket kendi başlığı altında. `npm run dev` ile çalıştırılır; birden fazla hesap gerektiğinde ayrı tarayıcı profilleri ya da gizli pencere kullanılır.

---

## Bekleyen elle testler (yapılacaklar)

Aşağıdaki adımların hiçbiri için kayıtlı bir elle test sonucu yok. Paketlerin ilerleme notlarında yalnızca iki gözlem var:
- Paket 2'nin elle testi çalıştırılmadı.
- Paket 4 sonrasında (F-32 düzeltmesi) dev modunda iki pencerede mesajların yenilemeden geldiği görüldü.

Bu yüzden tüm adımlar açık bırakıldı. Daha önce yaptığınız bir adım varsa yalnızca o kutuyu işaretleyin.

**Nasıl çalıştırılır:**
- **Dev:** `npm run dev`.
- **Prod:** `npm run build && npm start`. `.env` içindeki `NEXT_PUBLIC_SITE_URL` build sırasında pakete gömülür; build'den önce `http://localhost:3000` olmalı.
- Paket 2 ve 3 için dev yeterli. Socket paketleri (4 ve 5) iki modda da denenmeli.

Bir adım başarısız olursa adım numarasını, modu (dev/prod), tarayıcı konsolunu, sunucu konsolunu ve WS Mesajlar görünümünü not edin.

| Paket | Adımlar | dev | prod |
|---|---|---|---|
| 2: profil ve e-posta gizleme | 1–6 | [ ] | — |
| 3: mesaj geçmişi erişimi | 1–7 | [ ] | — |
| 4: socket kimlik ve odalar | 1–2 (token'sız red, gösterge) | [ ] | [ ] |
| 4 | 3 (üye canlı mesaj alıyor; dev'de bir kez gözlendi, düzenleme/silme dahil tam tekrar gerekli) | [ ] | [ ] |
| 4 | 4–7 (üye olmayan almıyor, ham WebSocket `ok:false`, özel sohbet, sohbet değiştirme) | [ ] | [ ] |
| 4 | 8–9 (atılan ve ayrılan üye, çok sekme) | [ ] | [ ] |
| 4 | 10–11 (yeniden bağlanma, uzun oturum) | [ ] | [ ] |
| 4 | 12 (ses/görüntü kanalı) | [ ] | [ ] |
| 4 | 13 (WebSocket 101 ile açık kalıyor, F-32; henüz gözle doğrulanmadı) | [ ] | [ ] |
| 5: yeniden doğrulama ve silinen odalar | 1–6 (kanal/sunucu silme, F-27) | [ ] | [ ] |
| 5 | 7–8 (30 sn'de bir `auth:refresh`, arka plan sekmesi) | [ ] | [ ] |
| 5 | 9 (Clerk Dashboard'dan oturum iptali) | [ ] | [ ] |
| 5 | 10 (hesap değiştirme; Multi-session kapalıysa "uygulanamaz" yazın) | [ ] | [ ] |
| 5 | 11 (sunucu yeniden başlatma) | [ ] | [ ] |

**Önerilen sıra:**
1. Paket 4'ün 13. adımı: diğer socket adımları buna bağlı.
2. Paket 4'ün 1–3. adımları.
3. Paket 5'in 7. adımı.
4. Geri kalanlar.

---

## Paket 2 — Profil erişimi ve e-postanın gizlenmesi (Görev 2: F-12, F-02 ek)

> Not: Bu liste, paket 2'nin oturum raporu yerine `docs/plan.md` Görev 2 (Adım 1'deki elle doğrulama senaryosu) ve o paketin ilerleme notlarındaki kararlardan yeniden derlendi.

1. **Davet linkiyle ilk giriş:** Hiç giriş yapmamış yeni bir hesapla doğrudan bir davet linkini (`/invite/<kod>`) açın, kaydı tamamlayın → profil oluşturulmalı ve kullanıcı sunucuya katılmış olarak sunucu sayfasına gitmeli.
2. **Oturumsuz davet linki:** Çıkış yapmış bir tarayıcıda davet linkini açın → Clerk giriş sayfasına yönlenmeli (middleware); hata sayfası görünmemeli. Giriş sonrası davete geri dönülüp sunucuya katılınmalı. (Karar: davet sayfası artık `<RedirectToSignIn/>` kullanmıyor; oturum yoksa `/home`'a yönleniyor.)
3. **İlk kurulum:** Yeni bir hesapla `/` açın → profil oluşturulmalı ve sunucu oluşturma modalı (ya da mevcut sunucu) açılmalı.
4. **Üyeler modalı:** Sunucu sahibi olarak sunucu menüsünden "Kullanıcıları Yönet" modalını açın → kendi e-postanız görünmeli, diğer üyelerin e-postası görünmemeli.
5. **Ağ yanıtlarında e-posta yok:** Tarayıcı geliştirici araçlarının Ağ sekmesinde `/api/messages`, `/api/direct-messages` ve `/api/members/...` yanıtlarına bakın → başka kullanıcıların `email` ya da `userID` alanı bulunmamalı.
6. **Socket yayınlarında e-posta yok:** Ağ sekmesinin WS kısmında yeni mesaj, düzenleme ve silme olaylarının payload'larına bakın → hiçbir `email` alanı (gönderenin kendisininki dahil) bulunmamalı.

---

## Paket 3 — Mesaj geçmişi erişimi (Görev 3: F-01)

İki hesap gerekir: **A** ve **B** (5. adım için üçüncü hesap **C**).

1. A bir sunucu oluşturur; B bu sunucuya katılmaz. A'nın `general` kanalının kimliğini URL'den kopyalayın.
2. B oturumundaki tarayıcıda `/api/messages?channelId=<kanalId>` adresini açın → **403 Forbidden** gelmeli.
3. A oturumunda aynı adres → **200** ve `{ items, nextCursor }` gelmeli.
4. A kanala 15'ten fazla mesaj yazsın. A oturumunda `/api/messages?channelId=<kanalId>` yanıtındaki `nextCursor` değerini alıp `/api/messages?channelId=<kanalId>&cursor=<nextCursor>` adresini açın → **200** ve önceki mesajlar gelmeli. B oturumunda aynı adres → **403**.
   - Not: Arayüzde yukarı kaydırarak sayfalama F-05 nedeniyle henüz çalışmıyor (Görev 8); bu yüzden sayfalama burada API üzerinden doğrulanıyor.
5. A ile B'yi aynı sunucuya katın ve aralarında özel sohbet açın. Sohbet kimliğini URL'den ya da Ağ sekmesindeki `/api/direct-messages?conversationId=...` isteğinden alın.
   - C `/api/direct-messages?conversationId=<id>` adresini açsın → **403**.
   - A ve B için aynı adres → **200**.
6. Aynı sunucuda kanal ve özel sohbet ekranları hem A'da hem B'de normal yüklenmeli (mesaj geçmişi görünmeli).
7. A, B'yi sunucudan atsın. B'nin açık kanal sekmesi en geç bir dakika içinde yeniden çekmeyi denediğinde 403 almalı (Ağ sekmesinde görünür). Arayüzün hata durumuna düşmesi beklenen davranıştır; düzeltmesi F-22 kapsamında Görev 8'de.

---

## Paket 4 — Socket kimlik doğrulama ve sohbet odaları (Görev 4: F-02; Görev 5'ten öne alınan istemci ve atma/ayrılma kısmı)

**Hazırlık:** `npm run dev`. İki ayrı tarayıcı kullanın (ör. Chrome ve Firefox; ya da bir normal ve bir gizli pencere). Hesaplar: **A** (sunucu sahibi), **B** (üye), **C** (üye değil). C için üçüncü bir tarayıcı profili gerekir; yoksa B'nin tarayıcısında çıkış yapıp C ile girin.

Tarayıcı konsolunda olayları görmek için: React DevTools olmadan socket'e erişim yok. Bu yüzden **Ağ sekmesi → WS → `/api/socket/ws` bağlantısı → Mesajlar** görünümünü kullanın. Gelen her olay `42["chat:...",...]` biçiminde görünür.

1. **Token'sız bağlantı reddediliyor:** Çıkış yapılmış bir pencerede `/home` açın → Ağ sekmesinde `/api/socket/io` ve `/api/socket/ws` istekleri **hiç açılmamalı** (oturum yokken istemci bağlanmaz). Konsolda `const ws = new WebSocket(`ws://${location.host}/api/socket/ws/?EIO=4&transport=websocket`); ws.onmessage = (e) => { console.log(e.data); if (e.data.startsWith("0{")) ws.send("40"); };` çalıştırın → token gönderilmediği için sunucu `44{"message":"unauthorized"}` dönmeli.
2. **Bağlantı göstergesi:** A ile giriş yapın ve bir kanalı açın → sağ üstteki socket göstergesi "canlı" (yeşil) olmalı. WS mesajlarında giden `42X["chat:join","<kanalId>"]` ve dönen `43X[{"ok":true}]` görülmeli.
3. **Üye canlı mesaj alıyor:** B, A'nın sunucusuna davet linkiyle katılır. İki tarayıcıda aynı `general` kanalını açın. A bir mesaj yazsın → B'de **yenilemeden** görünmeli. Düzenleme ve silme de B'de anında yansımalı.
4. **Üye olmayan almıyor:** C ile giriş yapın (A'nın sunucusuna üye değil). C'nin tarayıcısında kendi sunucusunun bir kanalını açın ve WS mesajlarını izleyin. A, `general` kanalına mesaj yazsın → C'nin WS akışında `chat:<A'nın kanalId>:messages` olayı **görünmemeli**.
5. **İstemcinin "odaya katıl" demesi yetmiyor:** C'nin tarayıcısında konsolu açıp aşağıdakini çalıştırın (`<kanalId>` yerine A'nın `general` kanalının kimliğini yazın):
   ```js
   const t = await window.Clerk.session.getToken();
   const ws = new WebSocket(`ws://${location.host}/api/socket/ws/?EIO=4&transport=websocket`);
   ws.onmessage = (e) => {
     console.log(e.data);
     if (e.data === "2") ws.send("3");                                    // ping/pong
     if (e.data.startsWith("0{")) ws.send("40" + JSON.stringify({ token: t }));
     if (e.data.startsWith("40{")) ws.send('420["chat:join","<kanalId>"]');
   };
   ```
   → konsolda `430[{"ok":false}]` görülmeli. A kanala mesaj yazsın → bu WebSocket'e `42["chat:<kanalId>:messages",...]` **gelmemeli**. Aynı kodu B'nin tarayıcısında çalıştırırsanız `430[{"ok":true}]` ve A'nın mesajı gelmeli.
6. **Özel sohbet:** A ile B arasında özel sohbet açın. İki tarafta da mesajlar canlı gelmeli. C'nin WS akışında bu sohbetin olayları görünmemeli.
7. **Sohbet değiştirme:** B, `general`'dan başka bir kanala geçsin → WS'de `chat:leave` (eski kanal) ve `chat:join` (yeni kanal) görülmeli. A eski kanala mesaj yazınca B'nin WS akışında o kanalın olayı artık görünmemeli.
8. **Atılan üye (iki sekme):** B'nin tarayıcısında aynı kanalı **iki sekmede**, A ile B'nin özel sohbetini de üçüncü sekmede açın. İsterseniz B'nin bir sekmesinde 5. adımdaki ham WebSocket'i de `chat:join` ile kanala sokun. A, "Kullanıcıları Yönet" menüsünden B'yi atsın, sonra kanala mesaj yazsın → B'nin **hiçbir sekmesinde** (ham WebSocket dahil) `chat:<kanalId>:messages` olayı görünmemeli. Özel sohbet atma ile birlikte silindiği için ona yeni mesaj yazılamaz. (Mesaj geçmişi isteklerinin 403'e düşüp arayüzde hata görünmesi F-22, Görev 8.)
9. **Ayrılan üye:** B'yi tekrar davet edin, kanalı açsın. B sunucu menüsünden "Sunucudan Ayrıl" yapsın; B'nin ikinci bir sekmesi aynı kanalda açık kalsın. A kanala yazsın → B'nin açık kalan sekmesine olay gelmemeli.
10. **Ağ kesintisi ve yeniden bağlanma:** B kanaldayken `npm run dev` sürecini durdurup 5 saniye sonra yeniden başlatın (Chrome'un "Çevrimdışı" ayarı açık WebSocket'i her sürümde koparmaz) → gösterge önce kırmızı sonra yeşil olmalı; WS'de yeni bağlantıda tekrar `chat:join` görülmeli. A'nın yazdığı yeni mesaj B'ye canlı gelmeli.
11. **Uzun oturum (token yenileme):** B'nin sekmesini 2 dakikadan uzun açık bırakın (Clerk token'ı ~60 sn geçerli), sonra 10. adımdaki gibi sunucuyu yeniden başlatın → yeniden bağlanma başarılı olmalı (taze token alınır). Sunucu konsolunda `unauthorized` hatası görülmemeli.
12. **Ses/görüntü kanalları etkilenmemeli:** Bir AUDIO kanalına girin → LiveKit odası eskisi gibi açılmalı (bu paket LiveKit'e dokunmuyor).
13. **WebSocket açık kalıyor (F-32):** Giriş yapmış olarak bir kanal açın → Ağ sekmesinde önce `/api/socket/io` (200), ardından `/api/socket/ws?...transport=websocket` isteği **101** ile açılmalı ve en az 2 dakika açık kalmalı (Mesajlar'da ~25 sn'de bir `2`/`3` ping-pong). Sunucu konsolunda `ping timeout` ya da `transport error` ile kopma görülmemeli. Bunu hem `npm run dev` hem `npm run build && npm start` ile deneyin; iki pencerede 3. adımı birkaç kez tekrarlayın, her seferinde mesaj yenilemeden gelmeli.

---

## Paket 5 — Socket yeniden doğrulama ve silinen sohbet odaları (Görev 5'in kalanı: F-25, F-29, F-27'nin atma kısmı)

Bu listedeki her adım **gerçek bir tarayıcıda**, iki modda **ayrı ayrı** denenir:

- **Dev:** `npm run dev` → `http://localhost:3000`
- **Prod:** `npm run build && npm start` → `http://localhost:3000`. `NEXT_PUBLIC_SITE_URL` build sırasında pakete gömülür; build'den önce `.env` içinde `http://localhost:3000` olmalı. Modlar arasında geçerken sunucuyu durdurup diğer modda yeniden başlatın ve sekmeleri yenileyin.

Her adımın sonundaki `[ ] dev  [ ] prod` kutularını ayrı ayrı işaretleyin. Bir modda geçip diğerinde kalan adım, ayrı bir hata olarak kaydedilmeli.

**Hazırlık:** İki ayrı tarayıcı kullanın (ör. Chrome ve Firefox). Hesaplar:
- **A:** sunucu **S**'nin sahibi.
- **B:** S'nin üyesi ve kendi sunucusu **T**'nin sahibi.

Olayları **Ağ → WS → `/api/socket/ws` → Mesajlar** görünümünden izleyin. Giden paketler yeşil (↑), gelenler kırmızı (↓) oktur.

> Odadan çıkarmanın kendisi (silinen kanal/sunucu odasında socket kalmaması) dışarıdan gözlenemez: silinen sohbete mesaj yazılamadığı için olay da üretilemez. Bu kısım `tests/integration/socket-rooms.test.ts` ile gerçek Socket.IO üzerinde doğrulanıyor. Aşağıdaki adımlar silme akışlarının bozulmadığını, fazla oda boşaltılmadığını ve yeniden doğrulamanın tarayıcıda çalıştığını denetler.

### A. Kanal ve sunucu silme (F-29)

1. **Kanal silme akışı bozulmadı:** A, S'de `sil-1` adında bir TEXT kanalı açsın. A ve B bu kanalı açsın; ikisinin WS akışında `chat:join` için `{"ok":true}` görülmeli. A kanal menüsünden kanalı silsin → istek **200** dönmeli ve A `general`'a yönlenmeli. Sunucu konsolunda `[CHANNEL_ID_DELETE]` hatası görülmemeli. `[ ] dev  [ ] prod`
2. **Diğer odalar etkilenmedi:** 1. adımdan sonra B `general`'a geçsin. A `general`'a mesaj yazsın → B'de **yenilemeden** görünmeli. A ile B'nin özel sohbetinde de mesajlar canlı gelmeye devam etmeli. `[ ] dev  [ ] prod`
3. **`general` silinemez:** A'nın konsolunda şunu çalıştırın: `fetch('/api/channels/<general kanalId>?serverId=<S id>', { method: 'DELETE' }).then(r => r.status)` → **500** dönmeli (F-11 düzeltilince 404 olacak). B'ye `general`'daki mesajlar gelmeye devam etmeli. `[ ] dev  [ ] prod`
4. **Sahibi olmayan sunucuyu silemez:** B'nin konsolunda şunu çalıştırın: `fetch('/api/servers/<S id>', { method: 'DELETE' }).then(r => r.status)` → **500** dönmeli. S yerinde kalmalı ve A'nın `general`'a yazdığı mesaj B'ye canlı gelmeli. `[ ] dev  [ ] prod`
5. **Sunucu silme:** B iki sekme açsın: birinde S'nin `general`'ı, diğerinde kendi sunucusu T'nin bir kanalı. A, S'yi sunucu ayarlarından silsin → istek **200** dönmeli ve sunucu konsolunda `[SERVER_ID_DELETE]` hatası görülmemeli. A, T'ye davet linkiyle önceden katılmış olsun (hazırlıkta yapılabilir). A, T'deki aynı kanala mesaj yazsın → mesaj B'nin T sekmesinde **yenilemeden** görünmeli. B'nin socket'i yalnızca S'nin odalarından çıkarılmış olmalı. `[ ] dev  [ ] prod`
6. **Sahibi olmayanın atma isteği:** B'nin konsolunda şunu çalıştırın: `fetch('/api/members/<A'nın memberId>?serverId=<S id>', { method: 'DELETE' }).then(r => r.status)` → **500** dönmeli ve A sunucuda kalmalı. (F-27: bu istek artık sohbet listesini okumuyor; bu kısım testte doğrulanıyor.) `[ ] dev  [ ] prod`

### B. Socket kimliğinin yeniden doğrulanması (F-25)

7. **Periyodik yenileme:** B bir kanalı açık tutsun. WS Mesajlar'da yaklaşık **30 saniyede bir** giden `42["auth:refresh","eyJ..."]` paketi görülmeli. Bağlantı en az **5 dakika** açık kalmalı ve gösterge yeşil kalmalı. Bu sürede A'nın yazdığı mesajlar canlı gelmeli. Sunucu konsolunda `[SOCKET_AUTH_REFRESH]` hatası görülmemeli. `[ ] dev  [ ] prod`
8. **Arka plan sekmesi:** B'nin sekmesini başka bir sekmeye geçerek **en az 6 dakika** arka planda bırakın; tarayıcı bu sürede zamanlayıcıları dakikada bire kısar. Sonra sekmeye dönün → dönüşte WS'de **hemen** bir `auth:refresh` gitmeli ve gösterge yeşil olmalı. Bağlantı arka planda kopmamış olmalı. A'nın yeni mesajı canlı gelmeli. Bağlantı koptuysa WS'de yeni bir bağlantı ve onun üzerinde `chat:join` → `{"ok":true}` görülmeli; mesaj yine canlı gelmeli. `[ ] dev  [ ] prod`
9. **Başka cihazdan oturum kapatma:** B'nin oturumunu Clerk Dashboard'dan kapatın (**Users → B → Sessions → Revoke**). Bunu B'nin açık sekmesine dokunmadan yapın. **En geç 3,5 dakika** içinde (180 sn yeniden doğrulama süresi + pay) B'nin sekmesinde iki şeyden biri olmalı: (a) gösterge kırmızıya döner ve WS bağlantısı kapanır, ya da (b) Clerk sayfayı oturumsuz duruma geçirir. Bu süreden sonra A'nın `general`'a yazdığı mesaj B'nin sekmesinde **görünmemeli**. Sunucu konsolunda kalıcı bir hata ya da sonsuz hızlı yeniden bağlanma döngüsü olmamalı; en fazla 5 saniyede bir `unauthorized` denemesi kabul edilir. `[ ] dev  [ ] prod`
10. **Hesap değiştirme (çoklu oturum):** Yalnızca Clerk Dashboard'da **Multi-session** açıksa yapılır; kapalıysa bu adımı "uygulanamaz" olarak işaretleyin. B, UserButton'dan **Add account** ile C hesabını eklesin ve C'ye geçsin → WS'de eski `/api/socket/ws` bağlantısı kapanmalı ve yeni bir bağlantı açılmalı. C'nin açtığı kanalda `chat:join` → `{"ok":true}` dönmeli ve mesajlar canlı gelmeli. B'ye geri geçince aynı şey tersinden olmalı. `[ ] dev  [ ] prod`
11. **Sunucu yeniden başlatma (Paket 4'teki 10–11. adımların tekrarı):** B kanaldayken sunucuyu durdurup 5 saniye sonra aynı modda yeniden başlatın. Gösterge önce kırmızı sonra yeşil olmalı; yeni bağlantıda `chat:join` ve 30 saniye içinde `auth:refresh` görülmeli. Prod modunda yeniden başlatma `npm start` ile yapılır, build tekrarlanmaz. `[ ] dev  [ ] prod`

| Adım | dev | prod |
|---|---|---|
| 1–6 (F-29, F-27) | [ ] | [ ] |
| 7–8 (yenileme) | [ ] | [ ] |
| 9 (oturum iptali) | [ ] | [ ] |
| 10 (hesap değiştirme) | [ ] | [ ] |
| 11 (yeniden başlatma) | [ ] | [ ] |
