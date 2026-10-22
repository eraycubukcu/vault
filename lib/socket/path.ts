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
// bir token REAUTH_TIMEOUT_MS içinde gelmezse socket'i koparır. Süre, arka plan sekmelerinde
// zamanlayıcıların dakikada bire kısılmasına dayanacak kadar uzun tutuldu.
export const AUTH_REFRESH_INTERVAL_MS = 30_000;
export const REAUTH_TIMEOUT_MS = 120_000;
