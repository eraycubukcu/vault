// @vitest-environment node
// F-03: LiveKit token'ı yalnızca sohbete erişimi olan kullanıcıya, sunucudaki profil kimliğiyle verilir.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { TokenVerifier } from "livekit-server-sdk";
import { accessData, installAccessDb, outsiderProfileId } from "../../helpers/access-db";
import { channel, conversation, otherProfile, viewerProfile } from "../../helpers/fixtures";

const db = vi.hoisted(() => ({
    channel: { findUnique: vi.fn() },
    member: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn() },
}));
const currentProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/current-profile", () => ({ currentProfile }));

import { GET } from "@/app/api/livekit/route";

const API_KEY = "test-key";
const API_SECRET = "test-secret-test-secret-test-secret";

const createdAt = new Date("2026-01-01T00:00:00Z");
const audioChannel = { ...channel, id: "c-audio", name: "sesli", type: "AUDIO" as const, createdAt, updatedAt: createdAt };
const videoChannel = { ...channel, id: "c-video", name: "görüntülü", type: "VIDEO" as const, createdAt, updatedAt: createdAt };
(accessData.channels as Array<Omit<typeof channel, "type"> & { type: string }>).push(audioChannel, videoChannel);

const get = (query: string) => GET(new NextRequest(`http://localhost/api/livekit?${query}`));
const claimsOf = async (res: Response) => new TokenVerifier(API_KEY, API_SECRET).verify((await res.json()).token);

beforeEach(() => {
    vi.clearAllMocks();
    installAccessDb(db);
    currentProfile.mockResolvedValue(viewerProfile);
    process.env.LIVEKIT_API_KEY = API_KEY;
    process.env.LIVEKIT_API_SECRET = API_SECRET;
    process.env.NEXT_PUBLIC_LIVEKIT_URL = "wss://livekit.example.com";
});

describe("GET /api/livekit — erişim", () => {
    it("oturum yoksa 401 döner ve token üretmez", async () => {
        currentProfile.mockResolvedValue(null);
        const res = await get(`room=${audioChannel.id}`);
        expect(res.status).toBe(401);
        expect(await res.json()).not.toHaveProperty("token");
    });

    it("room yoksa 400 döner", async () => {
        expect((await get("")).status).toBe(400);
    });

    it("kanalın sunucusuna üye olmayan kullanıcıya 403 döner", async () => {
        currentProfile.mockResolvedValue({ ...viewerProfile, id: outsiderProfileId });
        const res = await get(`room=${audioChannel.id}`);
        expect(res.status).toBe(403);
        expect(await res.json()).not.toHaveProperty("token");
    });

    it("özel sohbetin tarafı olmayan kullanıcıya 403 döner", async () => {
        currentProfile.mockResolvedValue({ ...viewerProfile, id: outsiderProfileId });
        expect((await get(`room=${conversation.id}`)).status).toBe(403);
    });

    it("var olmayan oda için 403 döner", async () => {
        expect((await get("room=yok")).status).toBe(403);
    });

    it("metin kanalı için (üye olsa bile) 403 döner", async () => {
        expect((await get(`room=${channel.id}`)).status).toBe(403);
    });
});

describe("GET /api/livekit — token içeriği", () => {
    it("identity ve görünen ad sunucudaki profilden gelir; username parametresi yok sayılır", async () => {
        const res = await get(`room=${audioChannel.id}&username=${encodeURIComponent(otherProfile.name)}&identity=${otherProfile.id}&name=Sahte`);
        expect(res.status).toBe(200);
        const claims = await claimsOf(res);
        expect(claims.sub).toBe(viewerProfile.id);
        expect(claims.name).toBe(viewerProfile.name);
    });

    it("oda adı veritabanındaki kanal kaydından türetilir", async () => {
        // Sorgu değeri ile satır kimliği farklı olsa bile token satırın kimliğini taşımalı.
        db.channel.findUnique.mockImplementation(async ({ where }: any) =>
            where.id === "C-AUDIO" ? audioChannel : null);
        const res = await get("room=C-AUDIO");
        expect(res.status).toBe(200);
        expect((await claimsOf(res)).video?.room).toBe(audioChannel.id);
    });

    it("oda adı veritabanındaki sohbet kaydından türetilir", async () => {
        const res = await get(`room=${conversation.id}`);
        expect(res.status).toBe(200);
        expect((await claimsOf(res)).video?.room).toBe(conversation.id);
    });

    it("token en fazla 10 dakika geçerlidir", async () => {
        // SDK `nbf`'i 0 yazıyor ve `iat` eklemiyor; ömür `exp` ile şimdiki zaman arasından ölçülür.
        const now = Math.floor(Date.now() / 1000);
        const claims = await claimsOf(await get(`room=${audioChannel.id}`));
        expect(claims.exp! - now).toBeGreaterThan(0);
        expect(claims.exp! - now).toBeLessThanOrEqual(10 * 60);
    });

    it("yalnızca katılma/yayın/abonelik yetkisi verir; yönetici yetkisi ve kendi adını değiştirme yok", async () => {
        const { video } = await claimsOf(await get(`room=${videoChannel.id}`));
        expect(video).toMatchObject({
            room: videoChannel.id,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            canUpdateOwnMetadata: false,
        });
        for (const grant of ["roomCreate", "roomList", "roomRecord", "roomAdmin", "ingressAdmin", "hidden", "recorder", "agent"]) {
            expect(video?.[grant as keyof typeof video], grant).toBeFalsy();
        }
    });

    it("sesli kanalda kamera yayını kapalı; mikrofon ve ekran paylaşımı açık", async () => {
        const { video } = await claimsOf(await get(`room=${audioChannel.id}`));
        expect(video?.canPublishSources?.slice().sort()).toEqual(["microphone", "screen_share", "screen_share_audio"]);
    });

    it("görüntülü kanalda ve özel sohbette kamera da açık", async () => {
        const all = ["camera", "microphone", "screen_share", "screen_share_audio"];
        for (const room of [videoChannel.id, conversation.id]) {
            const { video } = await claimsOf(await get(`room=${room}`));
            expect(video?.canPublishSources?.slice().sort(), room).toEqual(all);
        }
    });

    it("yanıt önbelleğe alınmaz", async () => {
        const res = await get(`room=${audioChannel.id}`);
        expect(res.headers.get("cache-control")).toBe("no-store");
    });
});
