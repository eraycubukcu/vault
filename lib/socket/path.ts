// İstemci ve sunucunun paylaştığı yollar (bu dosya socket.io sunucusunu içe aktarmaz).
//
// Next'in upgrade işleyicisi, yolu bir route ile eşleşen WebSocket isteklerinin soketini
// kapatıyor (router-server: `if (matchedOutput) return socket.end()`). Bu yüzden Socket.IO
// hiçbir route'a karşılık gelmeyen SOCKET_PATH'te dinler; SOCKET_INIT_URL ise yalnızca
// sunucuyu başlatan Pages API route'udur (pages/api/socket/io.ts).
export const SOCKET_PATH = "/api/socket/ws";
export const SOCKET_INIT_URL = "/api/socket/io";
