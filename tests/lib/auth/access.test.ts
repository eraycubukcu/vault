// @vitest-environment node
// F-01: kanal ve özel sohbet erişim kontrolleri.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { foreignChannel, installAccessDb, outsiderProfileId } from "../../helpers/access-db";
import { channel, conversation, otherProfile, viewerProfile } from "../../helpers/fixtures";

const db = vi.hoisted(() => ({
    channel: { findUnique: vi.fn(), findMany: vi.fn() },
    member: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn(), findMany: vi.fn() },
    server: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

import { canAccessChat, getChannelAccess, getConversationAccess, getMemberChatIds, getOwnedServerChatIds } from "@/lib/auth/access";

beforeEach(() => {
    vi.clearAllMocks();
    installAccessDb(db);
});

describe("getChannelAccess", () => {
    it("kanalın sunucusunda üye değilse null döner", async () => {
        expect(await getChannelAccess(outsiderProfileId, channel.id)).toBeNull();
    });

    it("başka bir sunucudaki üyelik erişim vermez", async () => {
        expect(await getChannelAccess(viewerProfile.id, foreignChannel.id)).toBeNull();
    });

    it("üyeyse kanalı ve kendi üyeliğini döner", async () => {
        const access = await getChannelAccess(otherProfile.id, channel.id);
        expect(access?.channel.id).toBe(channel.id);
        expect(access?.member.id).toBe("m-other");
        expect(access?.member.profileId).toBe(otherProfile.id);
    });

    it("kanal yoksa null döner", async () => {
        expect(await getChannelAccess(viewerProfile.id, "c-yok")).toBeNull();
        expect(db.member.findFirst).not.toHaveBeenCalled();
    });
});

describe("getConversationAccess", () => {
    // F-21: yetki Prisma where içinde de uygulanmalı; koddaki taraf kontrolü tek savunma kalmamalı.
    it("sorguyu iki taraftan biri olma koşuluyla (OR) yapar", async () => {
        await getConversationAccess(viewerProfile.id, conversation.id);
        expect(db.conversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                id: conversation.id,
                OR: [
                    { memberOne: { profileId: viewerProfile.id } },
                    { memberTwo: { profileId: viewerProfile.id } },
                ],
            },
        }));
    });

    it("üçüncü bir kişi için null döner", async () => {
        expect(await getConversationAccess(outsiderProfileId, conversation.id)).toBeNull();
    });

    it("birinci taraf için kendi üyeliğini döner", async () => {
        const access = await getConversationAccess(viewerProfile.id, conversation.id);
        expect(access?.conversation.id).toBe(conversation.id);
        expect(access?.member.id).toBe("m-viewer");
    });

    it("ikinci taraf için kendi üyeliğini döner", async () => {
        const access = await getConversationAccess(otherProfile.id, conversation.id);
        expect(access?.conversation.id).toBe(conversation.id);
        expect(access?.member.id).toBe("m-other");
    });

    it("sohbet yoksa null döner", async () => {
        expect(await getConversationAccess(viewerProfile.id, "conv-yok")).toBeNull();
    });
});

describe("canAccessChat", () => {
    // F-23: sohbet kimliği için kanal sorgusunun bitmesi beklenmemeli (iki sorgu paralel).
    it("kanal ve sohbet sorgularını aynı anda başlatır", async () => {
        let releaseChannel!: (value: null) => void;
        db.channel.findUnique.mockImplementation(() => new Promise((resolve) => { releaseChannel = resolve; }));
        const result = canAccessChat(viewerProfile.id, conversation.id);
        await Promise.resolve();
        expect(db.conversation.findFirst).toHaveBeenCalled();
        releaseChannel(null);
        expect(await result).toBe(true);
    });

    it("erişilebilir kanal için true", async () => {
        expect(await canAccessChat(viewerProfile.id, channel.id)).toBe(true);
    });

    it("erişilebilir sohbet için true", async () => {
        expect(await canAccessChat(otherProfile.id, conversation.id)).toBe(true);
    });

    it("ne kanal ne sohbet erişilebilir değilse false", async () => {
        expect(await canAccessChat(outsiderProfileId, channel.id)).toBe(false);
        expect(await canAccessChat(outsiderProfileId, conversation.id)).toBe(false);
        expect(await canAccessChat(viewerProfile.id, "bilinmeyen-id")).toBe(false);
    });
});

// F-02: atılan/ayrılan üyenin socket'i bu listedeki odalardan çıkarılır.
describe("getMemberChatIds", () => {
    const channels = [{ id: "c-1", serverId: "s-1" }, { id: "c-9", serverId: "s-1" }, { id: "c-2", serverId: "s-2" }];
    const conversations = [
        { id: "conv-1", memberOneId: "m-viewer", memberTwoId: "m-other" },
        { id: "conv-2", memberOneId: "m-third", memberTwoId: "m-other" },
        { id: "conv-3", memberOneId: "m-viewer", memberTwoId: "m-third" },
    ];

    beforeEach(() => {
        db.channel.findMany.mockImplementation(async ({ where }: any) =>
            channels.filter((c) => c.serverId === where.serverId).map(({ id }) => ({ id })));
        db.conversation.findMany.mockImplementation(async ({ where }: any) =>
            conversations
                .filter((conv) => (where.OR as Record<string, string>[]).some((cond) =>
                    Object.entries(cond).every(([key, value]) => (conv as any)[key] === value)))
                .map(({ id }) => ({ id })));
    });

    it("sunucunun tüm kanallarını ve üyenin her iki taraftan da katıldığı sohbetleri döner", async () => {
        const ids = await getMemberChatIds({ id: "m-other", serverId: "s-1" });
        expect(ids.sort()).toEqual(["c-1", "c-9", "conv-1", "conv-2"]);
    });

    it("başka sunucunun kanallarını ve üyenin taraf olmadığı sohbetleri içermez", async () => {
        const ids = await getMemberChatIds({ id: "m-third", serverId: "s-2" });
        expect(ids.sort()).toEqual(["c-2", "conv-2", "conv-3"]);
    });
});

// F-29: sunucu silinince kanal odaları ve üyelerin özel sohbet odaları (Member silinince
// Conversation da silinir) boşaltılır. Ön okuma yalnızca sahip için yapılır (F-27 dersi).
describe("getOwnedServerChatIds", () => {
    const servers = [
        { id: "s-1", profileId: "p-owner", channels: [{ id: "c-1" }, { id: "c-9" }], members: [{ id: "m-a" }, { id: "m-b" }] },
    ];
    const conversations = [
        { id: "conv-1", memberOneId: "m-a", memberTwoId: "m-b" },
        { id: "conv-2", memberOneId: "m-x", memberTwoId: "m-a" },
        { id: "conv-3", memberOneId: "m-x", memberTwoId: "m-y" },
    ];

    beforeEach(() => {
        db.server.findFirst.mockImplementation(async ({ where, select }: any) => {
            const found = servers.find((s) => s.id === where.id && s.profileId === where.profileId);
            if (!found) return null;
            expect(select).toEqual({ channels: { select: { id: true } }, members: { select: { id: true } } });
            return { channels: found.channels, members: found.members };
        });
        db.conversation.findMany.mockImplementation(async ({ where }: any) =>
            conversations
                .filter((conv) => (where.OR as Record<string, { in: string[] }>[]).some((cond) =>
                    Object.entries(cond).every(([key, value]) => value.in.includes((conv as any)[key]))))
                .map(({ id }) => ({ id })));
    });

    it("sahip için kanalları ve üyelerin taraf olduğu sohbetleri döner", async () => {
        const ids = await getOwnedServerChatIds("p-owner", "s-1");
        expect(ids.sort()).toEqual(["c-1", "c-9", "conv-1", "conv-2"]);
    });

    it("sahip olmayan için boş döner ve sohbet sorgusu çalışmaz", async () => {
        expect(await getOwnedServerChatIds("p-baska", "s-1")).toEqual([]);
        expect(db.conversation.findMany).not.toHaveBeenCalled();
    });
});
