// @vitest-environment node
// F-02: socket bağlantısı Clerk token'ı ile doğrulanmadan kabul edilmemeli.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { viewerProfile } from "../../helpers/fixtures";

const { verifyToken } = vi.hoisted(() => ({ verifyToken: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ verifyToken }));

const db = vi.hoisted(() => ({ profile: { findUnique: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));

import { authenticateSocket, profileIdFromToken } from "@/lib/socket/auth";

const fakeSocket = (auth: Record<string, unknown>) => ({ handshake: { auth }, data: {} as Record<string, unknown> }) as any;

beforeEach(() => {
    vi.clearAllMocks();
    db.profile.findUnique.mockImplementation(async ({ where }: any) =>
        where.userID === viewerProfile.userID ? viewerProfile : null);
});

const expectUnauthorized = (next: ReturnType<typeof vi.fn>, socket: any) => {
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("unauthorized");
    expect(socket.data.profileId).toBeUndefined();
};

describe("authenticateSocket", () => {
    it("token yoksa bağlantıyı reddeder", async () => {
        const socket = fakeSocket({});
        const next = vi.fn();
        await authenticateSocket(socket, next);
        expectUnauthorized(next, socket);
        expect(verifyToken).not.toHaveBeenCalled();
    });

    it("token geçersizse bağlantıyı reddeder", async () => {
        verifyToken.mockRejectedValue(new Error("bad signature"));
        const socket = fakeSocket({ token: "bozuk" });
        const next = vi.fn();
        await authenticateSocket(socket, next);
        expectUnauthorized(next, socket);
    });

    it("token geçerli ama profil yoksa bağlantıyı reddeder", async () => {
        verifyToken.mockResolvedValue({ sub: "user_yok" });
        const socket = fakeSocket({ token: "gecerli" });
        const next = vi.fn();
        await authenticateSocket(socket, next);
        expectUnauthorized(next, socket);
    });

    it("geçerli token ile profileId yazılır ve next() argümansız çağrılır", async () => {
        verifyToken.mockResolvedValue({ sub: viewerProfile.userID });
        const socket = fakeSocket({ token: "gecerli" });
        const next = vi.fn();
        await authenticateSocket(socket, next);
        expect(verifyToken).toHaveBeenCalledWith("gecerli", expect.objectContaining({ secretKey: process.env.CLERK_SECRET_KEY }));
        expect(socket.data.profileId).toBe(viewerProfile.id);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });

    it("token string değilse doğrulamaya göndermeden reddeder", async () => {
        const socket = fakeSocket({ token: { sub: viewerProfile.userID } });
        const next = vi.fn();
        await authenticateSocket(socket, next);
        expectUnauthorized(next, socket);
        expect(verifyToken).not.toHaveBeenCalled();
    });
});

// F-25: auth:refresh aynı doğrulamayı kullanır.
describe("profileIdFromToken", () => {
    it("geçerli token için profil id'sini döndürür", async () => {
        verifyToken.mockResolvedValue({ sub: viewerProfile.userID });
        expect(await profileIdFromToken("gecerli")).toBe(viewerProfile.id);
    });

    it("token yoksa ya da string değilse doğrulamadan null döner", async () => {
        expect(await profileIdFromToken(null)).toBeNull();
        expect(await profileIdFromToken({ sub: viewerProfile.userID })).toBeNull();
        expect(verifyToken).not.toHaveBeenCalled();
    });

    it("geçersiz token için null döner", async () => {
        verifyToken.mockRejectedValue(new Error("expired"));
        expect(await profileIdFromToken("eski")).toBeNull();
    });

    it("profili olmayan kullanıcı için null döner", async () => {
        verifyToken.mockResolvedValue({ sub: "user_yok" });
        expect(await profileIdFromToken("gecerli")).toBeNull();
    });
});
