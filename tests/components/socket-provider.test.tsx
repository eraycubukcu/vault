// F-02 istemci: socket bağlantısı Clerk token'ı ile kurulmalı; her (yeniden) bağlanmada taze token alınmalı.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const auth = vi.hoisted(() => ({
    isSignedIn: true as boolean | undefined,
    userId: "user_a" as string | null,
    sessionId: "sess_a" as string | null,
    getToken: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => auth }));

const { ioMock, fake } = vi.hoisted(() => {
    const fake = { on: vi.fn(), emit: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), active: false, connected: false, io: { on: vi.fn() } };
    return { fake, ioMock: vi.fn(function () { return fake; }) };
});
vi.mock("socket.io-client", () => ({ io: ioMock }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { SocketProvider } from "@/components/ui/providers/socket-provider";
import { AUTH_REFRESH_INTERVAL_MS, REAUTH_TIMEOUT_MS } from "@/lib/socket/path";

beforeEach(() => {
    vi.clearAllMocks();
    auth.isSignedIn = true;
    auth.userId = "user_a";
    auth.sessionId = "sess_a";
    fake.connected = false;
    fetchMock.mockResolvedValue(new Response(null));
});

// globals kapalı olduğu için RTL kendiliğinden temizlemiyor; önceki testin provider'ı
// (zamanlayıcı ve visibilitychange dinleyicisiyle) sonrakine sızmasın.
afterEach(() => {
    cleanup();
});

describe("SocketProvider", () => {
    it("oturum yokken bağlanmaz", () => {
        auth.isSignedIn = false;
        render(<SocketProvider><div /></SocketProvider>);
        expect(ioMock).not.toHaveBeenCalled();
    });

    it("her bağlanma denemesinde getToken ile taze token gönderir", async () => {
        auth.getToken.mockResolvedValueOnce("t1").mockResolvedValueOnce("t2");
        render(<SocketProvider><div /></SocketProvider>);
        expect(ioMock).toHaveBeenCalledTimes(1);
        const options = (ioMock.mock.calls[0] as any[])[1];
        expect(typeof options.auth).toBe("function");

        const first = await new Promise((resolve) => options.auth(resolve));
        const second = await new Promise((resolve) => options.auth(resolve));
        expect(first).toEqual({ token: "t1" });
        expect(second).toEqual({ token: "t2" });
    });

    it("getToken hata verirse token'sız devam eder (bağlantı askıda kalmaz)", async () => {
        auth.getToken.mockRejectedValueOnce(new Error("offline"));
        render(<SocketProvider><div /></SocketProvider>);
        const options = (ioMock.mock.calls[0] as any[])[1];
        expect(await new Promise((resolve) => options.auth(resolve))).toEqual({ token: null });
    });

    // Next, yolu bir route ile eşleşen WebSocket upgrade'lerini kapatıyor; socket bu yüzden
    // route'u olmayan SOCKET_PATH'te dinliyor ve önce başlatma ucuna istek atılıyor.
    it("önce başlatma ucuna istek atar, sonra route'u olmayan socket yoluna bağlanır", async () => {
        render(<SocketProvider><div /></SocketProvider>);
        const options = (ioMock.mock.calls[0] as any[])[1];
        expect(options.path).toBe("/api/socket/ws");
        expect(options.autoConnect).toBe(false);
        expect(fetchMock).toHaveBeenCalledWith("/api/socket/io");
        await waitFor(() => expect(fake.connect).toHaveBeenCalledTimes(1));
    });

    it("başlatma isteği başarısız olsa da bağlanmayı dener", async () => {
        fetchMock.mockRejectedValueOnce(new Error("offline"));
        render(<SocketProvider><div /></SocketProvider>);
        await waitFor(() => expect(fake.connect).toHaveBeenCalledTimes(1));
    });

    it("başlatma isteği bitmeden unmount olursa bağlanmaz", async () => {
        let finish!: (r: Response) => void;
        fetchMock.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
        const { unmount } = render(<SocketProvider><div /></SocketProvider>);
        unmount();
        finish(new Response(null));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(fake.connect).not.toHaveBeenCalled();
    });

    it("yeniden bağlanma denemelerinde sunucuyu yeniden başlatma ucunu çağırır", () => {
        render(<SocketProvider><div /></SocketProvider>);
        const onAttempt = fake.io.on.mock.calls.find(([event]) => event === "reconnect_attempt")![1];
        fetchMock.mockClear();
        onAttempt();
        expect(fetchMock).toHaveBeenCalledWith("/api/socket/io");
    });

    it("sunucu bağlantıyı reddederse bir süre sonra yeniden dener", async () => {
        vi.useFakeTimers();
        try {
            // İlk başlatma isteği askıda kalsın; connect yalnızca yeniden denemeden gelsin.
            fetchMock.mockReturnValueOnce(new Promise(() => {}));
            render(<SocketProvider><div /></SocketProvider>);
            const onConnectError = fake.on.mock.calls.find(([event]) => event === "connect_error")![1];
            fake.active = false;
            onConnectError(new Error("unauthorized"));
            expect(fake.connect).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(5000);
            expect(fake.connect).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("çıkış yapılınca eski socket'i kapatır, yeniden girişte yenisini açar", () => {
        const { rerender } = render(<SocketProvider><div /></SocketProvider>);
        expect(ioMock).toHaveBeenCalledTimes(1);

        auth.isSignedIn = false;
        rerender(<SocketProvider><div /></SocketProvider>);
        expect(fake.disconnect).toHaveBeenCalledTimes(1);

        auth.isSignedIn = true;
        rerender(<SocketProvider><div /></SocketProvider>);
        expect(ioMock).toHaveBeenCalledTimes(2);
    });

    it("unmount olunca bağlantıyı kapatır", () => {
        const { unmount } = render(<SocketProvider><div /></SocketProvider>);
        unmount();
        expect(fake.disconnect).toHaveBeenCalled();
    });

    // F-25: Clerk çoklu oturumda hesap değişince isSignedIn true kalır; socket eski profilde kalmamalı.
    it("hesap (userId) değişince eski socket'i kapatıp yenisini açar", () => {
        const { rerender } = render(<SocketProvider><div /></SocketProvider>);
        expect(ioMock).toHaveBeenCalledTimes(1);
        auth.userId = "user_b";
        auth.sessionId = "sess_b";
        rerender(<SocketProvider><div /></SocketProvider>);
        expect(fake.disconnect).toHaveBeenCalledTimes(1);
        expect(ioMock).toHaveBeenCalledTimes(2);
    });

    it("aynı hesapta oturum (sessionId) değişince de socket'i yeniler", () => {
        const { rerender } = render(<SocketProvider><div /></SocketProvider>);
        auth.sessionId = "sess_a2";
        rerender(<SocketProvider><div /></SocketProvider>);
        expect(fake.disconnect).toHaveBeenCalledTimes(1);
        expect(ioMock).toHaveBeenCalledTimes(2);
    });

    it("bağlıyken düzenli aralıklarla taze token'ı auth:refresh ile gönderir", async () => {
        vi.useFakeTimers();
        try {
            auth.getToken.mockResolvedValue("taze");
            render(<SocketProvider><div /></SocketProvider>);
            fake.connected = true;
            await vi.advanceTimersByTimeAsync(AUTH_REFRESH_INTERVAL_MS);
            expect(fake.emit).toHaveBeenCalledWith("auth:refresh", "taze");
            fake.emit.mockClear();
            await vi.advanceTimersByTimeAsync(AUTH_REFRESH_INTERVAL_MS);
            expect(fake.emit).toHaveBeenCalledWith("auth:refresh", "taze");
        } finally {
            vi.useRealTimers();
        }
    });

    it("bağlı değilken auth:refresh göndermez; unmount sonrası zamanlayıcı durur", async () => {
        vi.useFakeTimers();
        try {
            auth.getToken.mockResolvedValue("taze");
            const { unmount } = render(<SocketProvider><div /></SocketProvider>);
            await vi.advanceTimersByTimeAsync(AUTH_REFRESH_INTERVAL_MS);
            expect(fake.emit).not.toHaveBeenCalled();
            fake.connected = true;
            unmount();
            await vi.advanceTimersByTimeAsync(AUTH_REFRESH_INTERVAL_MS * 2);
            expect(fake.emit).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it("token alınamazsa null gönderir (sunucu süreyi uzatmaz)", async () => {
        vi.useFakeTimers();
        try {
            auth.getToken.mockRejectedValue(new Error("signed out"));
            render(<SocketProvider><div /></SocketProvider>);
            fake.connected = true;
            await vi.advanceTimersByTimeAsync(AUTH_REFRESH_INTERVAL_MS);
            expect(fake.emit).toHaveBeenCalledWith("auth:refresh", null);
        } finally {
            vi.useRealTimers();
        }
    });

    // Sunucu yeniden doğrulama süresi dolunca socket'i koparır; socket.io bu durumda kendiliğinden
    // yeniden bağlanmaz. İstemci taze token ile yeniden denemeli.
    it("sunucu bağlantıyı koparınca (io server disconnect) bir süre sonra yeniden bağlanır", async () => {
        vi.useFakeTimers();
        try {
            fetchMock.mockReturnValueOnce(new Promise(() => {}));
            render(<SocketProvider><div /></SocketProvider>);
            const onDisconnect = fake.on.mock.calls.find(([event]) => event === "disconnect")![1];
            onDisconnect("io server disconnect");
            expect(fake.connect).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(5000);
            expect(fake.connect).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("istemci tarafı kopmalarda kendi yeniden denemesini başlatmaz (socket.io zaten dener)", async () => {
        vi.useFakeTimers();
        try {
            fetchMock.mockReturnValueOnce(new Promise(() => {}));
            render(<SocketProvider><div /></SocketProvider>);
            const onDisconnect = fake.on.mock.calls.find(([event]) => event === "disconnect")![1];
            onDisconnect("transport close");
            await vi.advanceTimersByTimeAsync(5000);
            expect(fake.connect).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    // İnceleme M2: arka plan sekmesinde zamanlayıcılar dakikada bire kısılır. Sekme görünür
    // olunca beklemeden yenilenmeli ve süre, kısılmış iki periyotta bir başarısız denemeyi tolere etmeli.
    it("sekme görünür olunca beklemeden auth:refresh gönderir", async () => {
        auth.getToken.mockResolvedValue("taze");
        render(<SocketProvider><div /></SocketProvider>);
        fake.connected = true;
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
        await waitFor(() => expect(fake.emit).toHaveBeenCalledWith("auth:refresh", "taze"));
    });

    it("sekme gizlenirken auth:refresh göndermez; unmount sonrası dinleyici kalkar", async () => {
        auth.getToken.mockResolvedValue("taze");
        const { unmount } = render(<SocketProvider><div /></SocketProvider>);
        fake.connected = true;
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
        const added = vi.spyOn(document, "addEventListener");
        const removed = vi.spyOn(document, "removeEventListener");
        unmount();
        expect(added).not.toHaveBeenCalled();
        expect(removed).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
        added.mockRestore();
        removed.mockRestore();
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(fake.emit).not.toHaveBeenCalled();
    });

    it("yeniden doğrulama süresi, dakikaya kısılmış zamanlayıcıda bir başarısız yenilemeyi tolere eder", () => {
        // Başarılı (t=0), başarısız (t=60), sonraki deneme (t=120) süre dolmadan yetişmeli; pay ile 3 periyot.
        expect(REAUTH_TIMEOUT_MS).toBeGreaterThanOrEqual(3 * 60_000);
    });
});
