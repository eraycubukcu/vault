// @vitest-environment node
// F-02: mesaj handler'ları olayı herkese değil yalnızca ilgili sohbetin odasına yayınlamalı.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projecting } from "../../../helpers/prisma-fake";
import { channel, conversation, messageBy, server, viewerMember, viewerProfile } from "../../../helpers/fixtures";

const db = vi.hoisted(() => ({
    message: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    directMessage: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    server: { findFirst: vi.fn() },
    channel: { findFirst: vi.fn() },
    member: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/current-profile-pages", () => ({ currentProfilePages: vi.fn(async () => viewerProfile) }));

import socketMessages from "@/pages/api/socket/messages/index";
import socketMessageId from "@/pages/api/socket/messages/[messageId]";
import socketDirectMessages from "@/pages/api/socket/direct-messages/index";
import socketDirectMessageId from "@/pages/api/socket/direct-messages/[directMessageId]";

let roomEmit: ReturnType<typeof vi.fn>;
let io: any;

function pagesCall(method: string, query: Record<string, string>, body: unknown = {}) {
    const res: any = {
        statusCode: 0,
        status(code: number) { this.statusCode = code; return this; },
        json(data: unknown) { this.body = data; return this; },
        // Eski kod buradan herkese yayın yapıyordu; artık kullanılmamalı.
        socket: { server: { io } },
    };
    return { req: { method, query, body } as any, res };
}

const expectRoomEmit = (chatId: string, event: string) => {
    expect(io.to).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith(`chat:${chatId}`);
    expect(roomEmit).toHaveBeenCalledWith(event, expect.objectContaining({ id: expect.any(String) }));
    expect(io.emit).not.toHaveBeenCalled();
};

beforeEach(() => {
    vi.clearAllMocks();
    roomEmit = vi.fn();
    io = { emit: vi.fn(), to: vi.fn(() => ({ emit: roomEmit })) };
    globalThis.__vaultIO = io;
    db.server.findFirst.mockImplementation(projecting(server));
    db.channel.findFirst.mockResolvedValue(channel);
    db.member.findFirst.mockImplementation(projecting(viewerMember));
    db.conversation.findFirst.mockImplementation(projecting(conversation));
    db.message.findFirst.mockImplementation(projecting(messageBy(viewerMember)));
    db.message.create.mockImplementation(projecting(messageBy(viewerMember)));
    db.message.update.mockImplementation(projecting(messageBy(viewerMember)));
    db.directMessage.findFirst.mockImplementation(projecting(messageBy(viewerMember)));
    db.directMessage.create.mockImplementation(projecting(messageBy(viewerMember)));
    db.directMessage.update.mockImplementation(projecting(messageBy(viewerMember)));
});

afterEach(() => {
    globalThis.__vaultIO = undefined;
});

describe("socket mesaj handler'ları oda yayını", () => {
    it("POST kanal mesajı → yalnızca chat:{channelId} odasına", async () => {
        const { req, res } = pagesCall("POST", { serverId: "s-1", channelId: "c-1" }, { content: "merhaba" });
        await socketMessages(req, res);
        expect(res.statusCode).toBe(200);
        expectRoomEmit("c-1", "chat:c-1:messages");
        expect(roomEmit.mock.calls[0][1]).toEqual(res.body);
    });

    it.each(["PATCH", "DELETE"])("%s kanal mesajı → yalnızca chat:{channelId} odasına", async (method) => {
        const { req, res } = pagesCall(method, { messageId: "msg-m-viewer", serverId: "s-1", channelId: "c-1" }, { content: "yeni" });
        await socketMessageId(req, res);
        expect(res.statusCode).toBe(200);
        expectRoomEmit("c-1", "chat:c-1:messages:update");
    });

    it("POST özel mesaj → yalnızca chat:{conversationId} odasına", async () => {
        const { req, res } = pagesCall("POST", { conversationId: "conv-1" }, { content: "merhaba" });
        await socketDirectMessages(req, res);
        expect(res.statusCode).toBe(200);
        expectRoomEmit("conv-1", "chat:conv-1:messages");
    });

    it.each(["PATCH", "DELETE"])("%s özel mesaj → yalnızca chat:{conversationId} odasına", async (method) => {
        const { req, res } = pagesCall(method, { directMessageId: "msg-m-viewer", conversationId: "conv-1" }, { content: "yeni" });
        await socketDirectMessageId(req, res);
        expect(res.statusCode).toBe(200);
        expectRoomEmit("conv-1", "chat:conv-1:messages:update");
    });

    it("yetkisiz istek hiçbir yayın yapmaz", async () => {
        db.server.findFirst.mockResolvedValue(null);
        const { req, res } = pagesCall("POST", { serverId: "s-1", channelId: "c-1" }, { content: "merhaba" });
        await socketMessages(req, res);
        expect(res.statusCode).toBe(404);
        expect(io.to).not.toHaveBeenCalled();
        expect(io.emit).not.toHaveBeenCalled();
    });
});
