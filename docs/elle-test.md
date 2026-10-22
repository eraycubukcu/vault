# Elle Doğrulama Listeleri

Otomatik testlerin kapsamadığı, canlı Clerk + MongoDB (ve gerektiğinde ikinci bir cihaz) isteyen senaryolar. Her paket kendi başlığı altında. `npm run dev` ile çalıştırılır; birden fazla hesap gerektiğinde ayrı tarayıcı profilleri ya da gizli pencere kullanılır.

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
