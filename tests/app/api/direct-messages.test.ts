// @vitest-environment node
// F-01: özel mesaj geçmişi yalnızca sohbetin iki tarafına açık.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installAccessDb, outsiderProfileId } from "../../helpers/access-db";
import { conversation, messageBy, otherMember, otherProfile, viewerProfile } from "../../helpers/fixtures";

const db = vi.hoisted(() => ({
    channel: { findUnique: vi.fn() },
    member: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn() },
    directMessage: { findMany: vi.fn() },
}));
const currentProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/current-profile", () => ({ currentProfile }));

import { GET } from "@/app/api/direct-messages/route";

const get = (query: string) => GET(new Request(`http://localhost/api/direct-messages?${query}`));

beforeEach(() => {
    vi.clearAllMocks();
    installAccessDb(db);
    db.directMessage.findMany.mockResolvedValue([messageBy(otherMember)]);
    currentProfile.mockResolvedValue(viewerProfile);
});

describe("GET /api/direct-messages", () => {
    it("üye olmayan biri için 403 döner ve geçmişi sorgulamaz", async () => {
        currentProfile.mockResolvedValue({ ...viewerProfile, id: outsiderProfileId });
        const res = await get(`conversationId=${conversation.id}`);
        expect(res.status).toBe(403);
        expect(db.directMessage.findMany).not.toHaveBeenCalled();
    });

    it("cursor ile sayfalamada da üye olmayana 403 döner", async () => {
        currentProfile.mockResolvedValue({ ...viewerProfile, id: outsiderProfileId });
        const res = await get(`conversationId=${conversation.id}&cursor=msg-m-other`);
        expect(res.status).toBe(403);
        expect(db.directMessage.findMany).not.toHaveBeenCalled();
    });

    it("var olmayan sohbet için 403 döner", async () => {
        const res = await get("conversationId=conv-yok");
        expect(res.status).toBe(403);
        expect(db.directMessage.findMany).not.toHaveBeenCalled();
    });

    it("sohbetin birinci tarafı için 200 ve { items, nextCursor } döner", async () => {
        const res = await get(`conversationId=${conversation.id}`);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.nextCursor).toBeNull();
        expect(db.directMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId: conversation.id } }));
    });

    it("sohbetin ikinci tarafı için de 200 döner", async () => {
        currentProfile.mockResolvedValue(otherProfile);
        const res = await get(`conversationId=${conversation.id}`);
        expect(res.status).toBe(200);
    });

    it("oturum yoksa 401, conversationId yoksa 400 döner (değişmedi)", async () => {
        expect((await get("")).status).toBe(400);
        currentProfile.mockResolvedValue(null);
        expect((await get(`conversationId=${conversation.id}`)).status).toBe(401);
    });
});
