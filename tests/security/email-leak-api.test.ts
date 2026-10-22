// @vitest-environment node
// F-02 ek / F-12: başkalarına giden hiçbir yanıtta veya socket payload'ında
// e-posta (ve Clerk userID) bulunmamalı. Kişi yalnızca kendi e-postasını görebilir.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projecting } from "../helpers/prisma-fake";
import {
    OTHER_EMAIL, OTHER_USER_ID, VIEWER_EMAIL,
    channel, conversation, messageBy, otherMember, server, viewerMember, viewerProfile,
} from "../helpers/fixtures";

const db = vi.hoisted(() => ({
    message: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    directMessage: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    server: { findFirst: vi.fn(), update: vi.fn() },
    channel: { findFirst: vi.fn(), findUnique: vi.fn() },
    member: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/current-profile", () => ({ currentProfile: vi.fn(async () => viewerProfile) }));
vi.mock("@/lib/current-profile-pages", () => ({ currentProfilePages: vi.fn(async () => viewerProfile) }));

import { GET as getMessages } from "@/app/api/messages/route";
import { GET as getDirectMessages } from "@/app/api/direct-messages/route";
import { PATCH as patchMember, DELETE as deleteMember } from "@/app/api/members/[memberId]/route";
import socketMessages from "@/pages/api/socket/messages/index";
import socketMessageId from "@/pages/api/socket/messages/[messageId]";
import socketDirectMessages from "@/pages/api/socket/direct-messages/index";
import socketDirectMessageId from "@/pages/api/socket/direct-messages/[directMessageId]";

const expectNoForeignEmail = (payload: unknown) => {
    const text = JSON.stringify(payload);
    expect(text).not.toContain(OTHER_EMAIL);
    expect(text).not.toContain(OTHER_USER_ID);
};

const expectNoEmailAtAll = (payload: unknown) => {
    expectNoForeignEmail(payload);
    expect(JSON.stringify(payload)).not.toContain(VIEWER_EMAIL);
};

function pagesCall(method: string, query: Record<string, string>, body: unknown = {}) {
    const emit = vi.fn();
    const res: any = {
        statusCode: 0,
        body: undefined,
        status(code: number) { this.statusCode = code; return this; },
        json(data: unknown) { this.body = JSON.parse(JSON.stringify(data)); return this; },
        socket: { server: { io: { emit } } },
    };
    return { req: { method, query, body } as any, res, emit };
}

beforeEach(() => {
    vi.clearAllMocks();
    db.server.findFirst.mockImplementation(projecting(server));
    db.server.update.mockImplementation(projecting(server));
    db.channel.findFirst.mockResolvedValue(channel);
    db.channel.findUnique.mockResolvedValue(channel);
    db.member.findFirst.mockImplementation(projecting(viewerMember));
    db.conversation.findFirst.mockImplementation(projecting(conversation));
});

describe("mesaj geçmişi GET yanıtları", () => {
    it("GET /api/messages başka üyenin e-postasını döndürmez", async () => {
        db.message.findMany.mockImplementation(projecting([messageBy(otherMember)]));
        const res = await getMessages(new Request("http://localhost/api/messages?channelId=c-1"));
        const json = await res.json();
        expect(json.items[0].member.profile.name).toBe("Other");
        expectNoForeignEmail(json);
    });

    it("GET /api/direct-messages başka üyenin e-postasını döndürmez", async () => {
        db.directMessage.findMany.mockImplementation(projecting([messageBy(otherMember)]));
        const res = await getDirectMessages(new Request("http://localhost/api/direct-messages?conversationId=conv-1"));
        const json = await res.json();
        expect(json.items[0].member.profile.name).toBe("Other");
        expectNoForeignEmail(json);
    });
});

describe("üye yönetimi yanıtları", () => {
    const params = Promise.resolve({ memberId: otherMember.id });

    it("PATCH /api/members başkalarının e-postasını döndürmez, kendi e-postasını döndürür", async () => {
        const req = new Request("http://localhost/api/members/m-other?serverId=s-1", { method: "PATCH", body: JSON.stringify({ role: "MODERATOR" }) });
        const json = await (await patchMember(req, { params })).json();
        expectNoForeignEmail(json);
        const own = json.members.find((m: any) => m.id === viewerMember.id);
        expect(own.profile.email).toBe(VIEWER_EMAIL);
    });

    it("DELETE /api/members başkalarının e-postasını döndürmez, kendi e-postasını döndürür", async () => {
        const req = new Request("http://localhost/api/members/m-other?serverId=s-1", { method: "DELETE" });
        const json = await (await deleteMember(req, { params })).json();
        expectNoForeignEmail(json);
        const own = json.members.find((m: any) => m.id === viewerMember.id);
        expect(own.profile.email).toBe(VIEWER_EMAIL);
    });
});

// Socket olayları sohbetteki herkese gider; gönderenin kendi e-postası da yer almamalı.
describe("socket handler'ları: yanıt ve yayınlanan payload", () => {
    it("kanal mesajı gönderme", async () => {
        db.message.create.mockImplementation(projecting(messageBy(viewerMember)));
        const { req, res, emit } = pagesCall("POST", { serverId: "s-1", channelId: "c-1" }, { content: "merhaba" });
        await socketMessages(req, res);
        expect(res.statusCode).toBe(200);
        expect(emit).toHaveBeenCalledTimes(1);
        expectNoEmailAtAll(emit.mock.calls[0][1]);
        expectNoEmailAtAll(res.body);
    });

    it("kanal mesajı düzenleme", async () => {
        db.message.findFirst.mockImplementation(projecting(messageBy(viewerMember)));
        db.message.update.mockImplementation(projecting(messageBy(viewerMember)));
        const { req, res, emit } = pagesCall("PATCH", { messageId: "msg-m-viewer", serverId: "s-1", channelId: "c-1" }, { content: "yeni" });
        await socketMessageId(req, res);
        expect(res.statusCode).toBe(200);
        expectNoEmailAtAll(emit.mock.calls[0][1]);
        expectNoEmailAtAll(res.body);
    });

    it("kanal mesajı silme (admin, başkasının mesajı)", async () => {
        db.message.findFirst.mockImplementation(projecting(messageBy(otherMember)));
        db.message.update.mockImplementation(projecting(messageBy(otherMember)));
        const { req, res, emit } = pagesCall("DELETE", { messageId: "msg-m-other", serverId: "s-1", channelId: "c-1" });
        await socketMessageId(req, res);
        expect(res.statusCode).toBe(200);
        expectNoEmailAtAll(emit.mock.calls[0][1]);
        expectNoEmailAtAll(res.body);
    });

    it("özel mesaj gönderme", async () => {
        db.directMessage.create.mockImplementation(projecting(messageBy(viewerMember)));
        const { req, res, emit } = pagesCall("POST", { conversationId: "conv-1" }, { content: "merhaba" });
        await socketDirectMessages(req, res);
        expect(res.statusCode).toBe(200);
        expectNoEmailAtAll(emit.mock.calls[0][1]);
        expectNoEmailAtAll(res.body);
    });

    it("özel mesaj düzenleme ve silme", async () => {
        db.directMessage.findFirst.mockImplementation(projecting(messageBy(viewerMember)));
        db.directMessage.update.mockImplementation(projecting(messageBy(viewerMember)));
        for (const method of ["PATCH", "DELETE"]) {
            const { req, res, emit } = pagesCall(method, { directMessageId: "msg-m-viewer", conversationId: "conv-1" }, { content: "yeni" });
            await socketDirectMessageId(req, res);
            expect(res.statusCode).toBe(200);
            expectNoEmailAtAll(emit.mock.calls[0][1]);
            expectNoEmailAtAll(res.body);
        }
    });
});
