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
