// F-02 istemci: socket bağlantısı Clerk token'ı ile kurulmalı; her (yeniden) bağlanmada taze token alınmalı.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const auth = vi.hoisted(() => ({ isSignedIn: true as boolean | undefined, getToken: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => auth }));

const { ioMock, fake } = vi.hoisted(() => {
    const fake = { on: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), active: false };
    return { fake, ioMock: vi.fn(function () { return fake; }) };
});
vi.mock("socket.io-client", () => ({ io: ioMock }));

import { SocketProvider } from "@/components/ui/providers/socket-provider";

beforeEach(() => {
    vi.clearAllMocks();
    auth.isSignedIn = true;
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
        expect(options.path).toBe("/api/socket/io");
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

    it("sunucu bağlantıyı reddederse bir süre sonra yeniden dener", () => {
        vi.useFakeTimers();
        try {
            render(<SocketProvider><div /></SocketProvider>);
            const onConnectError = fake.on.mock.calls.find(([event]) => event === "connect_error")![1];
            fake.active = false;
            onConnectError(new Error("unauthorized"));
            expect(fake.connect).not.toHaveBeenCalled();
            vi.advanceTimersByTime(5000);
            expect(fake.connect).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("unmount olunca bağlantıyı kapatır", () => {
        const { unmount } = render(<SocketProvider><div /></SocketProvider>);
        unmount();
        expect(fake.disconnect).toHaveBeenCalled();
    });
});
