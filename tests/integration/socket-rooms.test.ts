// @vitest-environment node
// F-02 entegrasyon: gerçek bir Socket.IO sunucusu ve gerçek istemcilerle
// - token'sız bağlantı reddedilir,
// - üye olmayan odaya katılamaz ve kanalın mesaj olaylarını almaz, üye alır,
// - sunucudan atılan / ayrılan kullanıcının bağlı socket'i odalardan çıkarılır.
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { installAccessDb, outsiderProfileId } from "../helpers/access-db";
import { projecting } from "../helpers/prisma-fake";
import { channel, conversation, otherMember, otherProfile, server, viewerMember, viewerProfile } from "../helpers/fixtures";

const outsiderProfile = { ...otherProfile, id: outsiderProfileId, userID: "user_outsider", name: "Outsider" };
const profiles = [viewerProfile, otherProfile, outsiderProfile];

// Test token'ı: "tok:<clerk userID>". Gerçek imza doğrulaması auth.test.ts'te mock'lanıyor.
const { verifyToken } = vi.hoisted(() => ({ verifyToken: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ verifyToken }));

const { currentProfile } = vi.hoisted(() => ({ currentProfile: vi.fn() }));
vi.mock("@/lib/current-profile", () => ({ currentProfile }));

const db = vi.hoisted(() => ({
    profile: { findUnique: vi.fn() },
    channel: { findUnique: vi.fn(), findMany: vi.fn() },
    member: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn(), findMany: vi.fn() },
    server: { update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

import { createSocketServer, emitToChat, leaveServerRooms } from "@/lib/socket/server";
import { DELETE as deleteMember } from "@/app/api/members/[memberId]/route";
import { PATCH as leaveServer } from "@/app/api/servers/[serverId]/leave/route";

let httpServer: HttpServer;
let url: string;
const clients: ClientSocket[] = [];

beforeAll(async () => {
    httpServer = createServer();
    createSocketServer(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
    globalThis.__vaultIO?.close();
    globalThis.__vaultIO = undefined;
    await new Promise((resolve) => httpServer.close(resolve));
});

beforeEach(() => {
    vi.clearAllMocks();
    verifyToken.mockImplementation(async (token: string) => {
        if (!token.startsWith("tok:")) throw new Error("invalid");
        return { sub: token.slice(4) };
    });
    db.profile.findUnique.mockImplementation(async ({ where }: any) =>
        profiles.find((p) => p.userID === where.userID) ?? null);
    installAccessDb(db);
});

afterEach(() => {
    clients.splice(0).forEach((client) => client.disconnect());
});

type Received = { event: string; payload: any }[];

function connectAs(profile: { userID: string } | null): Promise<{ client: ClientSocket; received: Received }> {
    const client = ioClient(url, {
        path: "/api/socket/io",
        addTrailingSlash: false,
        transports: ["websocket"],
        reconnection: false,
        auth: profile ? { token: `tok:${profile.userID}` } : {},
    });
    clients.push(client);
    const received: Received = [];
    client.onAny((event, payload) => received.push({ event, payload }));
    return new Promise((resolve, reject) => {
        client.on("connect", () => resolve({ client, received }));
        client.on("connect_error", reject);
    });
}

const join = (client: ClientSocket, chatId: string) =>
    new Promise<{ ok: boolean }>((resolve) => client.emit("chat:join", chatId, resolve));

// Aynı bağlantı üzerinden olaylar sırayla gelir: bariyer geldiyse ondan önce
// gönderilmiş olan olay da (gelecekse) gelmiştir.
async function barrier(...targets: { client: ClientSocket; profileId: string }[]) {
    await Promise.all(targets.map(({ client, profileId }) => new Promise<void>((resolve) => {
        client.once("test:barrier", () => resolve());
        globalThis.__vaultIO!.to(`profile:${profileId}`).emit("test:barrier");
    })));
}

const events = (received: Received, event: string) => received.filter((r) => r.event === event);

describe("socket kimlik doğrulama", () => {
    it("token'sız bağlantı unauthorized ile reddedilir", async () => {
        await expect(connectAs(null)).rejects.toThrow("unauthorized");
    });

    it("geçersiz token reddedilir", async () => {
        const client = ioClient(url, { path: "/api/socket/io", transports: ["websocket"], reconnection: false, auth: { token: "sahte" } });
        clients.push(client);
        await expect(new Promise((_, reject) => client.on("connect_error", reject))).rejects.toThrow("unauthorized");
    });
});

describe("kanal odaları", () => {
    it("üye olmayan katılamaz ve kanal mesajını almaz; üye alır", async () => {
        const viewer = await connectAs(viewerProfile);
        const outsider = await connectAs(outsiderProfile);

        expect(await join(viewer.client, channel.id)).toEqual({ ok: true });
        expect(await join(outsider.client, channel.id)).toEqual({ ok: false });

        const key = `chat:${channel.id}:messages`;
        emitToChat(channel.id, key, { id: "msg-1", content: "gizli" });
        await barrier({ client: viewer.client, profileId: viewerProfile.id }, { client: outsider.client, profileId: outsiderProfileId });

        expect(events(viewer.received, key)).toEqual([{ event: key, payload: { id: "msg-1", content: "gizli" } }]);
        expect(events(outsider.received, key)).toEqual([]);
    });

    it("odaya katılmamış üye de olayı almaz (yayın herkese gitmez)", async () => {
        const viewer = await connectAs(viewerProfile);
        const key = `chat:${channel.id}:messages`;
        emitToChat(channel.id, key, { id: "msg-2" });
        await barrier({ client: viewer.client, profileId: viewerProfile.id });
        expect(events(viewer.received, key)).toEqual([]);
    });

    it("özel sohbete yalnızca iki taraf katılabilir", async () => {
        const viewer = await connectAs(viewerProfile);
        const other = await connectAs(otherProfile);
        const outsider = await connectAs(outsiderProfile);

        expect(await join(viewer.client, conversation.id)).toEqual({ ok: true });
        expect(await join(other.client, conversation.id)).toEqual({ ok: true });
        expect(await join(outsider.client, conversation.id)).toEqual({ ok: false });

        const key = `chat:${conversation.id}:messages:update`;
        emitToChat(conversation.id, key, { id: "dm-1" });
        await barrier(
            { client: viewer.client, profileId: viewerProfile.id },
            { client: other.client, profileId: otherProfile.id },
            { client: outsider.client, profileId: outsiderProfileId },
        );
        expect(events(viewer.received, key)).toHaveLength(1);
        expect(events(other.received, key)).toHaveLength(1);
        expect(events(outsider.received, key)).toEqual([]);
    });

    it("chat:leave sonrası olay gelmez", async () => {
        const viewer = await connectAs(viewerProfile);
        expect(await join(viewer.client, channel.id)).toEqual({ ok: true });
        viewer.client.emit("chat:leave", channel.id);
        // İstemci → sunucu gidiş-dönüş: sunucu olayları sırayla işlediği için ack geldiyse leave de işlenmiştir.
        expect(await join(viewer.client, "olmayan-sohbet")).toEqual({ ok: false });
        const key = `chat:${channel.id}:messages`;
        emitToChat(channel.id, key, { id: "msg-3" });
        await barrier({ client: viewer.client, profileId: viewerProfile.id });
        expect(events(viewer.received, key)).toEqual([]);
    });
});

describe("üyelik bitince odadan çıkarma", () => {
    async function viewerAndOtherInRooms() {
        const viewer = await connectAs(viewerProfile);
        const other = await connectAs(otherProfile);
        // Aynı kullanıcının ikinci sekmesi de çıkarılmalı.
        const otherTab2 = await connectAs(otherProfile);
        for (const client of [viewer.client, other.client, otherTab2.client]) {
            expect(await join(client, channel.id)).toEqual({ ok: true });
        }
        expect(await join(other.client, conversation.id)).toEqual({ ok: true });
        return { viewer, other, otherTab2 };
    }

    async function expectOtherEvicted({ viewer, other, otherTab2 }: Awaited<ReturnType<typeof viewerAndOtherInRooms>>) {
        const key = `chat:${channel.id}:messages`;
        const dmKey = `chat:${conversation.id}:messages`;
        emitToChat(channel.id, key, { id: "after-kick" });
        emitToChat(conversation.id, dmKey, { id: "dm-after-kick" });
        await barrier(
            { client: viewer.client, profileId: viewerProfile.id },
            { client: other.client, profileId: otherProfile.id },
            { client: otherTab2.client, profileId: otherProfile.id },
        );
        expect(events(viewer.received, key)).toHaveLength(1);
        expect(events(other.received, key)).toEqual([]);
        expect(events(otherTab2.received, key)).toEqual([]);
        expect(events(other.received, dmKey)).toEqual([]);
    }

    beforeEach(() => {
        db.channel.findMany.mockImplementation(projecting(server.channels));
        db.conversation.findMany.mockImplementation(projecting([conversation]));
        db.server.update.mockImplementation(projecting(server));
    });

    it("leaveServerRooms bağlı tüm sekmeleri odalardan çıkarır", async () => {
        const sockets = await viewerAndOtherInRooms();
        leaveServerRooms(otherProfile.id, [channel.id, conversation.id]);
        await expectOtherEvicted(sockets);
    });

    it("DELETE /api/members ile atılan üye artık kanal ve özel sohbet olaylarını almaz", async () => {
        const sockets = await viewerAndOtherInRooms();
        currentProfile.mockResolvedValue(viewerProfile);
        const res = await deleteMember(
            new Request(`http://localhost/api/members/${otherMember.id}?serverId=${server.id}`, { method: "DELETE" }),
            { params: Promise.resolve({ memberId: otherMember.id }) },
        );
        expect(res.status).toBe(200);
        await expectOtherEvicted(sockets);
    });

    it("PATCH /api/servers/:id/leave ile ayrılan üye artık olayları almaz", async () => {
        const sockets = await viewerAndOtherInRooms();
        currentProfile.mockResolvedValue(otherProfile);
        const res = await leaveServer(
            new Request(`http://localhost/api/servers/${server.id}/leave`, { method: "PATCH" }),
            { params: Promise.resolve({ serverId: server.id }) },
        );
        expect(res.status).toBe(200);
        await expectOtherEvicted(sockets);
    });

    it("atma işlemi başarısız olursa (sahibi değil) kimse odadan çıkarılmaz", async () => {
        // Sahibi olmayan "other", "viewer"ı atmaya çalışıyor: hedef (viewer) odada kalmalı.
        const { viewer, other } = await viewerAndOtherInRooms();
        const viewerTab2 = await connectAs(viewerProfile);
        expect(await join(viewerTab2.client, channel.id)).toEqual({ ok: true });
        currentProfile.mockResolvedValue(otherProfile);
        db.server.update.mockRejectedValue(new Error("Record to update not found."));
        vi.spyOn(console, "log").mockImplementation(() => {});
        const res = await deleteMember(
            new Request(`http://localhost/api/members/${viewerMember.id}?serverId=${server.id}`, { method: "DELETE" }),
            { params: Promise.resolve({ memberId: viewerMember.id }) },
        );
        expect(res.status).toBe(500);
        const key = `chat:${channel.id}:messages`;
        emitToChat(channel.id, key, { id: "still-here" });
        await barrier(
            { client: viewer.client, profileId: viewerProfile.id },
            { client: viewerTab2.client, profileId: viewerProfile.id },
            { client: other.client, profileId: otherProfile.id },
        );
        expect(events(viewer.received, key)).toHaveLength(1);
        expect(events(viewerTab2.received, key)).toHaveLength(1);
        expect(events(other.received, key)).toHaveLength(1);
    });
});
