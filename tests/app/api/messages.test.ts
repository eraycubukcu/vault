// @vitest-environment node
// F-01: kanal mesaj geçmişi yalnızca kanalın sunucusundaki üyelere açık.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installAccessDb, outsiderProfileId } from "../../helpers/access-db";
import { channel, messageBy, otherMember, viewerProfile } from "../../helpers/fixtures";

const db = vi.hoisted(() => ({
    channel: { findUnique: vi.fn() },
    member: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn() },
    message: { findMany: vi.fn() },
}));
const currentProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/current-profile", () => ({ currentProfile }));

import { GET } from "@/app/api/messages/route";

const get = (query: string) => GET(new Request(`http://localhost/api/messages?${query}`));

beforeEach(() => {
    vi.clearAllMocks();
    installAccessDb(db);
    db.message.findMany.mockResolvedValue([messageBy(otherMember)]);
    currentProfile.mockResolvedValue(viewerProfile);
});

describe("GET /api/messages", () => {
    it("üye olmayan biri için 403 döner ve geçmişi sorgulamaz", async () => {
        currentProfile.mockResolvedValue({ ...viewerProfile, id: outsiderProfileId });
        const res = await get(`channelId=${channel.id}`);
        expect(res.status).toBe(403);
        expect(db.message.findMany).not.toHaveBeenCalled();
    });

    it("cursor ile sayfalamada da üye olmayana 403 döner", async () => {
        currentProfile.mockResolvedValue({ ...viewerProfile, id: outsiderProfileId });
        const res = await get(`channelId=${channel.id}&cursor=msg-m-other`);
        expect(res.status).toBe(403);
        expect(db.message.findMany).not.toHaveBeenCalled();
    });

    it("var olmayan kanal için 403 döner", async () => {
        const res = await get("channelId=c-yok");
        expect(res.status).toBe(403);
        expect(db.message.findMany).not.toHaveBeenCalled();
    });

    it("üye için 200 ve { items, nextCursor } döner", async () => {
        const res = await get(`channelId=${channel.id}`);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.nextCursor).toBeNull();
        expect(db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { channelId: channel.id } }));
    });

    it("oturum yoksa 401, channelId yoksa 400 döner (değişmedi)", async () => {
        expect((await get("")).status).toBe(400);
        currentProfile.mockResolvedValue(null);
        expect((await get(`channelId=${channel.id}`)).status).toBe(401);
    });
});
