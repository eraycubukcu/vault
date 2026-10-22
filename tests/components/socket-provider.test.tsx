// F-02 istemci: socket bağlantısı Clerk token'ı ile kurulmalı; her (yeniden) bağlanmada taze token alınmalı.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const auth = vi.hoisted(() => ({ isSignedIn: true as boolean | undefined, getToken: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => auth }));

const { ioMock, fake } = vi.hoisted(() => {
    const fake = { on: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), active: false, io: { on: vi.fn() } };
    return { fake, ioMock: vi.fn(function () { return fake; }) };
});
vi.mock("socket.io-client", () => ({ io: ioMock }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { SocketProvider } from "@/components/ui/providers/socket-provider";

beforeEach(() => {
    vi.clearAllMocks();
    auth.isSignedIn = true;
    fetchMock.mockResolvedValue(new Response(null));
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
});
