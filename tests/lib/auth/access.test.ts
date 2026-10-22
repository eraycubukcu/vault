// @vitest-environment node
// F-01: kanal ve özel sohbet erişim kontrolleri.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { foreignChannel, installAccessDb, outsiderProfileId } from "../../helpers/access-db";
import { channel, conversation, otherProfile, viewerProfile } from "../../helpers/fixtures";

const db = vi.hoisted(() => ({
    channel: { findUnique: vi.fn() },
    member: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

import { canAccessChat, getChannelAccess, getConversationAccess } from "@/lib/auth/access";

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
