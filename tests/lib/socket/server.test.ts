// @vitest-environment node
// F-02: odaya katılma sunucu tarafında yetkiye bağlı; olaylar yalnızca ilgili odaya gider.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { canAccessChat } = vi.hoisted(() => ({ canAccessChat: vi.fn() }));
vi.mock("@/lib/auth/access", () => ({ canAccessChat }));

const { profileIdFromToken } = vi.hoisted(() => ({ profileIdFromToken: vi.fn() }));
vi.mock("@/lib/socket/auth", () => ({ authenticateSocket: vi.fn(), profileIdFromToken }));

import { closeChatRooms, emitToChat, getIO, leaveServerRooms, registerSocketHandlers } from "@/lib/socket/server";
import { REAUTH_TIMEOUT_MS } from "@/lib/socket/path";

function fakeIO() {
    const roomEmit = vi.fn();
    const socketsLeave = vi.fn();
    const io: any = {
        on: vi.fn(),
        emit: vi.fn(),
        to: vi.fn(() => ({ emit: roomEmit })),
        in: vi.fn(() => ({ socketsLeave })),
    };
    return { io, roomEmit, socketsLeave };
}

function fakeSocket(profileId = "p1") {
    const handlers: Record<string, (...args: any[]) => any> = {};
    const socket: any = {
        data: { profileId },
        join: vi.fn(),
        leave: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn((event: string, handler: (...args: any[]) => any) => { handlers[event] = handler; }),
    };
    return { socket, handlers };
}

function connect(profileId = "p1") {
    const { io } = fakeIO();
    registerSocketHandlers(io);
    expect(io.on).toHaveBeenCalledWith("connection", expect.any(Function));
    const onConnection = io.on.mock.calls[0][1];
    const { socket, handlers } = fakeSocket(profileId);
    onConnection(socket);
    return { socket, handlers };
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    globalThis.__vaultIO = undefined;
});

describe("registerSocketHandlers", () => {
    it("bağlanan socket kendi profil odasına katılır", () => {
        const { socket } = connect("p1");
        expect(socket.join).toHaveBeenCalledWith("profile:p1");
    });

    it("chat:join yetki yoksa odaya katmaz ve ok:false döner", async () => {
        canAccessChat.mockResolvedValue(false);
        const { socket, handlers } = connect("p1");
        socket.join.mockClear();
        const ack = vi.fn();
        await handlers["chat:join"]("c1", ack);
        expect(canAccessChat).toHaveBeenCalledWith("p1", "c1");
        expect(socket.join).not.toHaveBeenCalled();
        expect(ack).toHaveBeenCalledWith({ ok: false });
    });

    it("chat:join yetki varsa chat:c1 odasına katar ve ok:true döner", async () => {
        canAccessChat.mockResolvedValue(true);
        const { socket, handlers } = connect("p1");
        const ack = vi.fn();
        await handlers["chat:join"]("c1", ack);
        expect(socket.join).toHaveBeenCalledWith("chat:c1");
        expect(ack).toHaveBeenCalledWith({ ok: true });
    });

    it("chat:join string olmayan id'yi yetki sorgusuna göndermeden reddeder", async () => {
        const { socket, handlers } = connect("p1");
        socket.join.mockClear();
        const ack = vi.fn();
        await handlers["chat:join"]({ $ne: null }, ack);
        expect(canAccessChat).not.toHaveBeenCalled();
        expect(socket.join).not.toHaveBeenCalled();
        expect(ack).toHaveBeenCalledWith({ ok: false });
    });

    it("chat:join yetki sorgusu hata verirse odaya katmaz ve ok:false döner", async () => {
        canAccessChat.mockRejectedValue(new Error("db down"));
        vi.spyOn(console, "log").mockImplementation(() => {});
        const { socket, handlers } = connect("p1");
        socket.join.mockClear();
        const ack = vi.fn();
        await handlers["chat:join"]("c1", ack);
        expect(socket.join).not.toHaveBeenCalled();
        expect(ack).toHaveBeenCalledWith({ ok: false });
    });

    it("chat:join ack verilmezse de çalışır", async () => {
        canAccessChat.mockResolvedValue(true);
        const { socket, handlers } = connect("p1");
        await handlers["chat:join"]("c1");
        expect(socket.join).toHaveBeenCalledWith("chat:c1");
    });

    // İnceleme bulgusu 1: yetki kontrolü sürerken üyelik silinirse (atılma) katılım geri alınmalı.
    it("chat:join katıldıktan sonra yetki kalkmışsa odadan çıkarır ve ok:false döner", async () => {
        canAccessChat.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const { socket, handlers } = connect("p1");
        const ack = vi.fn();
        await handlers["chat:join"]("c1", ack);
        expect(canAccessChat).toHaveBeenCalledTimes(2);
        expect(socket.join).toHaveBeenCalledWith("chat:c1");
        expect(socket.leave).toHaveBeenCalledWith("chat:c1");
        expect(socket.join.mock.invocationCallOrder.at(-1)).toBeLessThan(socket.leave.mock.invocationCallOrder.at(-1));
        expect(ack).toHaveBeenCalledWith({ ok: false });
    });

    // İnceleme bulgusu 3: kontrol sürerken gelen chat:leave, geç tamamlanan join'i iptal etmeli.
    it("yetki kontrolü sürerken chat:leave gelirse odaya katmaz", async () => {
        let grant!: (value: boolean) => void;
        canAccessChat.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
        canAccessChat.mockResolvedValue(true);
        const { socket, handlers } = connect("p1");
        socket.join.mockClear();
        const ack = vi.fn();
        const pending = handlers["chat:join"]("c1", ack);
        handlers["chat:leave"]("c1");
        grant(true);
        await pending;
        expect(socket.join).not.toHaveBeenCalledWith("chat:c1");
        expect(ack).toHaveBeenCalledWith({ ok: false });
    });

    it("chat:leave odadan çıkarır", () => {
        const { socket, handlers } = connect("p1");
        handlers["chat:leave"]("c1");
        expect(socket.leave).toHaveBeenCalledWith("chat:c1");
    });
});

// F-25: kimlik yalnızca handshake'te doğrulanırsa oturumu kapatılmış cihaz dinlemeye devam eder.
// İstemci periyodik olarak taze token gönderir; aynı profile ait geçerli token belirli süre
// gelmezse ya da token başka bir profile aitse sunucu socket'i koparır.
describe("auth:refresh ve yeniden doğrulama süresi", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("geçerli token yenilenmezse süre dolunca socket'i koparır", async () => {
        const { socket } = connect("p1");
        await vi.advanceTimersByTimeAsync(REAUTH_TIMEOUT_MS - 1);
        expect(socket.disconnect).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it("aynı profile ait geçerli token süreyi uzatır ve ok:true döner", async () => {
        profileIdFromToken.mockResolvedValue("p1");
        const { socket, handlers } = connect("p1");
        await vi.advanceTimersByTimeAsync(REAUTH_TIMEOUT_MS - 1000);
        const ack = vi.fn();
        await handlers["auth:refresh"]("taze", ack);
        expect(profileIdFromToken).toHaveBeenCalledWith("taze");
        expect(ack).toHaveBeenCalledWith({ ok: true });
        await vi.advanceTimersByTimeAsync(REAUTH_TIMEOUT_MS - 1);
        expect(socket.disconnect).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it("geçersiz token (ör. oturum kapatılmış) süreyi uzatmaz ve ok:false döner", async () => {
        profileIdFromToken.mockResolvedValue(null);
        const { socket, handlers } = connect("p1");
        await vi.advanceTimersByTimeAsync(REAUTH_TIMEOUT_MS - 1000);
        const ack = vi.fn();
        await handlers["auth:refresh"](null, ack);
        expect(ack).toHaveBeenCalledWith({ ok: false });
        expect(socket.disconnect).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1000);
        expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it("başka bir profile ait token gelirse socket'i hemen koparır", async () => {
        profileIdFromToken.mockResolvedValue("p2");
        const { socket, handlers } = connect("p1");
        const ack = vi.fn();
        await handlers["auth:refresh"]("baska-hesap", ack);
        expect(socket.disconnect).toHaveBeenCalledWith(true);
        expect(ack).toHaveBeenCalledWith({ ok: false });
    });

    it("doğrulama hata verirse süreyi uzatmaz, socket'i hemen koparmaz", async () => {
        profileIdFromToken.mockRejectedValue(new Error("jwks down"));
        vi.spyOn(console, "log").mockImplementation(() => {});
        const { socket, handlers } = connect("p1");
        const ack = vi.fn();
        await handlers["auth:refresh"]("t", ack);
        expect(ack).toHaveBeenCalledWith({ ok: false });
        expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it("bağlantı kapanınca zamanlayıcı temizlenir", async () => {
        const { socket, handlers } = connect("p1");
        handlers["disconnect"]("client namespace disconnect");
        await vi.advanceTimersByTimeAsync(REAUTH_TIMEOUT_MS * 2);
        expect(socket.disconnect).not.toHaveBeenCalled();
    });
});

describe("emitToChat / leaveServerRooms / closeChatRooms", () => {
    it("emitToChat yalnızca sohbet odasına yayınlar, io.emit kullanmaz", () => {
        const { io, roomEmit } = fakeIO();
        globalThis.__vaultIO = io;
        const payload = { id: "m1" };
        emitToChat("c1", "e", payload);
        expect(getIO()).toBe(io);
        expect(io.to).toHaveBeenCalledWith("chat:c1");
        expect(roomEmit).toHaveBeenCalledWith("e", payload);
        expect(io.emit).not.toHaveBeenCalled();
    });

    it("io yokken emitToChat sessizce hiçbir şey yapmaz", () => {
        expect(() => emitToChat("c1", "e", {})).not.toThrow();
    });

    it("leaveServerRooms profilin tüm socket'lerini verilen sohbet odalarından çıkarır", () => {
        const { io, socketsLeave } = fakeIO();
        globalThis.__vaultIO = io;
        leaveServerRooms("p2", ["c1", "conv-1"]);
        expect(io.in).toHaveBeenCalledWith("profile:p2");
        expect(socketsLeave).toHaveBeenCalledWith(["chat:c1", "chat:conv-1"]);
    });

    it("leaveServerRooms boş listeyle hiçbir odadan çıkarmaz", () => {
        const { io, socketsLeave } = fakeIO();
        globalThis.__vaultIO = io;
        leaveServerRooms("p2", []);
        expect(socketsLeave).not.toHaveBeenCalled();
    });

    // F-29: silinen kanal/sunucunun odalarında kimse kalmamalı.
    it("closeChatRooms verilen odalardaki tüm socket'leri o odalardan çıkarır", () => {
        const { io, socketsLeave } = fakeIO();
        globalThis.__vaultIO = io;
        closeChatRooms(["c1", "conv-1"]);
        expect(io.in).toHaveBeenCalledWith(["chat:c1", "chat:conv-1"]);
        expect(socketsLeave).toHaveBeenCalledWith(["chat:c1", "chat:conv-1"]);
    });

    it("closeChatRooms boş listeyle hiçbir şey yapmaz", () => {
        const { io, socketsLeave } = fakeIO();
        globalThis.__vaultIO = io;
        closeChatRooms([]);
        expect(io.in).not.toHaveBeenCalled();
        expect(socketsLeave).not.toHaveBeenCalled();
    });
});
