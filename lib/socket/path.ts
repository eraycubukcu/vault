// İstemci ve sunucunun paylaştığı yollar (bu dosya socket.io sunucusunu içe aktarmaz).
//
// Next'in upgrade işleyicisi, yolu bir route ile eşleşen WebSocket isteklerinin soketini
// kapatıyor (router-server: `if (matchedOutput) return socket.end()`). Bu yüzden Socket.IO
// hiçbir route'a karşılık gelmeyen SOCKET_PATH'te dinler; SOCKET_INIT_URL ise yalnızca
// sunucuyu başlatan Pages API route'udur (pages/api/socket/io.ts).
export const SOCKET_PATH = "/api/socket/ws";
export const SOCKET_INIT_URL = "/api/socket/io";

// F-25: kimlik yalnızca handshake'te doğrulanırsa oturumu kapatılmış cihaz dinlemeye devam eder.
// İstemci bu aralıkla taze token'ı "auth:refresh" ile gönderir; sunucu aynı profile ait geçerli
// bir token REAUTH_TIMEOUT_MS içinde gelmezse socket'i koparır. Arka plan sekmelerinde
// zamanlayıcılar dakikada bire kısıldığı için süre, bir başarısız yenilemeyi tolere edecek
// kadar (3 kısılmış periyot) uzun; sekme görünür olunca da beklemeden yenilenir.
// İptal edilen bir oturumun son token'ı kendi ömrü (~60 sn) boyunca geçerli kaldığından, en kötü
// durumda dinleme token ömrü + REAUTH_TIMEOUT_MS kadar sürebilir.
export const AUTH_REFRESH_INTERVAL_MS = 30_000;
export const REAUTH_TIMEOUT_MS = 180_000;
