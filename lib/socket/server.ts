import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { canAccessChat } from "@/lib/auth/access";
import { authenticateSocket } from "@/lib/socket/auth";
import { SOCKET_PATH } from "@/lib/socket/path";

// Tek örnek (tek container) varsayımı: io örneği globalThis üzerinden hem
// Pages API hem App Router route'larına açılır. Çoklu örnekte Redis adapter gerekir.
declare global {
    // eslint-disable-next-line no-var
    var __vaultIO: Server | undefined;
}

const chatRoom = (chatId: string) => `chat:${chatId}`;
const profileRoom = (profileId: string) => `profile:${profileId}`;

export function getIO(): Server | undefined {
    return globalThis.__vaultIO;
}

export function registerSocketHandlers(io: Server): void {
    io.on("connection", (socket: Socket) => {
        const profileId: string = socket.data.profileId;
        socket.join(profileRoom(profileId));

        // Bu socket'in şu an açık tutmak istediği sohbetler. Kontrol sürerken gelen
        // chat:leave, geç tamamlanan join'in odaya sokmasını engeller.
        const wanted = new Set<string>();

        // Odaya katılmak istemcinin isteğiyle değil, sunucudaki yetki kontrolüyle olur.
        socket.on("chat:join", async (chatId: unknown, ack?: (r: { ok: boolean }) => void) => {
            const reply = typeof ack === "function" ? ack : () => {};
            if (typeof chatId !== "string" || !chatId) {
                return reply({ ok: false });
            }
            wanted.add(chatId);
            try {
                if (!(await canAccessChat(profileId, chatId)) || !wanted.has(chatId)) {
                    return reply({ ok: false });
                }
                socket.join(chatRoom(chatId));
                // İlk kontrol ile join arasında üyelik silinmiş (ve leaveServerRooms bu socket'i
                // henüz odada bulamamış) olabilir; tekrar kontrol edip gerekirse geri al.
                if (!(await canAccessChat(profileId, chatId)) || !wanted.has(chatId)) {
                    socket.leave(chatRoom(chatId));
                    return reply({ ok: false });
                }
                reply({ ok: true });
            } catch (error) {
                console.log("[SOCKET_CHAT_JOIN]", error);
                socket.leave(chatRoom(chatId));
                reply({ ok: false });
            }
        });

        socket.on("chat:leave", (chatId: unknown) => {
            if (typeof chatId === "string") {
                wanted.delete(chatId);
                socket.leave(chatRoom(chatId));
            }
        });
    });
}

export function createSocketServer(httpServer: HttpServer): Server {
    const io = new Server(httpServer, {
        path: SOCKET_PATH,
        addTrailingSlash: false,
    });
    io.use(authenticateSocket);
    registerSocketHandlers(io);
    globalThis.__vaultIO = io;
    return io;
}

export function emitToChat(chatId: string, event: string, payload: unknown): void {
    getIO()?.to(chatRoom(chatId)).emit(event, payload);
}

// Profilin bağlı tüm socket'lerini (tüm sekmeler) verilen sohbet odalarından çıkarır.
export function leaveServerRooms(profileId: string, chatIds: string[]): void {
    if (chatIds.length === 0) {
        return;
    }
    getIO()?.in(profileRoom(profileId)).socketsLeave(chatIds.map(chatRoom));
}
