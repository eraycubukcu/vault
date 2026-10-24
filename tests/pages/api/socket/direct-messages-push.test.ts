// @vitest-environment node
// F-06: özel mesaj kaydedilince alıcıya push bildirimi gider; alıcı sohbeti açık tutuyorsa
// (bir socket'i chat:{conversationId} odasındaysa) gönderilmez. Bildirim yanıtı bekletmez.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projecting } from "../../../helpers/prisma-fake";
import { conversation, messageBy, otherMember, otherProfile, viewerMember, viewerProfile } from "../../../helpers/fixtures";

const db = vi.hoisted(() => ({
    conversation: { findFirst: vi.fn() },
    directMessage: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

const currentProfilePages = vi.hoisted(() => vi.fn());
vi.mock("@/lib/current-profile-pages", () => ({ currentProfilePages }));

const notifyProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/push", () => ({ notifyProfile }));

import socketDirectMessages from "@/pages/api/socket/direct-messages/index";

let roomSockets: Array<{ data: { profileId: string } }>;
let io: any;

function call(body: unknown) {
    const res: any = {
        statusCode: 0,
        status(code: number) { this.statusCode = code; return this; },
        json(data: unknown) { this.body = data; return this; },
    };
    return { req: { method: "POST", query: { conversationId: "conv-1" }, body } as any, res };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    vi.clearAllMocks();
    roomSockets = [];
    io = {
        to: vi.fn(() => ({ emit: vi.fn() })),
        in: vi.fn(() => ({ fetchSockets: vi.fn(async () => roomSockets) })),
    };
    globalThis.__vaultIO = io;
    currentProfilePages.mockResolvedValue(viewerProfile);
    db.conversation.findFirst.mockImplementation(projecting(conversation));
    db.directMessage.create.mockImplementation(projecting(messageBy(viewerMember)));
    notifyProfile.mockResolvedValue(undefined);
});

afterEach(() => {
    globalThis.__vaultIO = undefined;
});

describe("POST /api/socket/direct-messages bildirimi", () => {
    it("alıcıya gönderenin adı, kısaltılmış içerik ve sohbet URL'siyle bildirim gönderir", async () => {
        const { req, res } = call({ content: "merhaba" });
        await socketDirectMessages(req, res);
        await flush();
        expect(res.statusCode).toBe(200);
        expect(io.in).toHaveBeenCalledWith("chat:conv-1");
        expect(notifyProfile).toHaveBeenCalledTimes(1);
        expect(notifyProfile).toHaveBeenCalledWith(otherProfile.id, {
            title: viewerProfile.name,
            body: "merhaba",
            url: `/servers/${viewerMember.serverId}/conversations/${viewerMember.id}`,
        });
    });

    it("içeriği 120 karaktere kısaltır", async () => {
        const { req, res } = call({ content: "a".repeat(300) });
        await socketDirectMessages(req, res);
        await flush();
        expect(notifyProfile.mock.calls[0][1].body).toBe("a".repeat(120));
    });

    it("gönderen memberTwo ise alıcı memberOne olur ve URL gönderenin üye kimliğini taşır", async () => {
        currentProfilePages.mockResolvedValue(otherProfile);
        db.directMessage.create.mockImplementation(projecting(messageBy(otherMember)));
        const { req, res } = call({ content: "selam" });
        await socketDirectMessages(req, res);
        await flush();
        expect(notifyProfile).toHaveBeenCalledWith(viewerProfile.id, {
            title: otherProfile.name,
            body: "selam",
            url: `/servers/${otherMember.serverId}/conversations/${otherMember.id}`,
        });
    });

    it("alıcının bir socket'i sohbet odasındaysa bildirim göndermez", async () => {
        roomSockets = [{ data: { profileId: otherProfile.id } }];
        const { req, res } = call({ content: "merhaba" });
        await socketDirectMessages(req, res);
        await flush();
        expect(res.statusCode).toBe(200);
        expect(notifyProfile).not.toHaveBeenCalled();
    });

    it("odada yalnızca gönderen varsa bildirim yine gönderilir", async () => {
        roomSockets = [{ data: { profileId: viewerProfile.id } }];
        const { req, res } = call({ content: "merhaba" });
        await socketDirectMessages(req, res);
        await flush();
        expect(notifyProfile).toHaveBeenCalledTimes(1);
    });

    it("oda sorgusu hata verirse bildirim yine gönderilir", async () => {
        io.in = vi.fn(() => ({ fetchSockets: vi.fn(async () => { throw new Error("adapter"); }) }));
        const { req, res } = call({ content: "merhaba" });
        await socketDirectMessages(req, res);
        await flush();
        expect(notifyProfile).toHaveBeenCalledTimes(1);
    });

    it("bildirim bitmeden yanıt döner (await edilmez)", async () => {
        notifyProfile.mockReturnValue(new Promise(() => {}));
        const { req, res } = call({ content: "merhaba" });
        await socketDirectMessages(req, res);
        expect(res.statusCode).toBe(200);
    });

    it("bildirim reddedilse de yanıt 200 ve işlenmemiş reddetme oluşmaz", async () => {
        const unhandled = vi.fn();
        process.on("unhandledRejection", unhandled);
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        notifyProfile.mockRejectedValue(new Error("push down"));
        const { req, res } = call({ content: "merhaba" });
        await socketDirectMessages(req, res);
        await flush();
        await flush();
        process.off("unhandledRejection", unhandled);
        logSpy.mockRestore();
        expect(res.statusCode).toBe(200);
        expect(unhandled).not.toHaveBeenCalled();
    });

    it("mesaj kaydedilemezse bildirim gönderilmez", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        db.directMessage.create.mockRejectedValue(new Error("db down"));
        const { req, res } = call({ content: "merhaba" });
        await socketDirectMessages(req, res);
        await flush();
        logSpy.mockRestore();
        expect(res.statusCode).toBe(500);
        expect(notifyProfile).not.toHaveBeenCalled();
    });
});
