// @vitest-environment node
// F-02: odaya katılma sunucu tarafında yetkiye bağlı; olaylar yalnızca ilgili odaya gider.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { canAccessChat } = vi.hoisted(() => ({ canAccessChat: vi.fn() }));
vi.mock("@/lib/auth/access", () => ({ canAccessChat }));

import { emitToChat, getIO, leaveServerRooms, registerSocketHandlers } from "@/lib/socket/server";

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

    it("chat:leave odadan çıkarır", () => {
        const { socket, handlers } = connect("p1");
        handlers["chat:leave"]("c1");
        expect(socket.leave).toHaveBeenCalledWith("chat:c1");
    });
});

describe("emitToChat / leaveServerRooms", () => {
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
});
