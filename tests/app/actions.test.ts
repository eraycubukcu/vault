// @vitest-environment node
// F-04: push aboneliği profile bağlı, kimlik doğrulamalı ve kalıcı olmalı; herkese açık
// sendNotification action'ı kalmamalı.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { viewerProfile } from "../helpers/fixtures";

const currentProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/current-profile", () => ({ currentProfile }));

const db = vi.hoisted(() => ({ pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));

import * as actions from "@/app/actions";
import { subscribeUser, unsubscribeUser } from "@/app/actions";

const sub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
};

beforeEach(() => {
    vi.clearAllMocks();
    currentProfile.mockResolvedValue(viewerProfile);
    db.pushSubscription.upsert.mockResolvedValue({});
    db.pushSubscription.deleteMany.mockResolvedValue({ count: 0 });
    db.pushSubscription.findMany.mockResolvedValue([]);
});

describe("subscribeUser", () => {
    it("oturum yoksa { success: false } döner ve veritabanına dokunmaz", async () => {
        currentProfile.mockResolvedValue(null);
        await expect(subscribeUser(sub)).resolves.toEqual({ success: false });
        expect(db.pushSubscription.upsert).not.toHaveBeenCalled();
    });

    it("aynı endpoint ile iki kez çağrılınca iki kez endpoint üzerinden upsert eder", async () => {
        await expect(subscribeUser(sub)).resolves.toEqual({ success: true });
        await expect(subscribeUser(sub)).resolves.toEqual({ success: true });
        expect(db.pushSubscription.upsert).toHaveBeenCalledTimes(2);
        expect(db.pushSubscription.upsert).toHaveBeenLastCalledWith({
            where: { endpoint: sub.endpoint },
            create: { profileId: viewerProfile.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            update: { profileId: viewerProfile.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        });
    });

    it.each([
        ["https olmayan endpoint", { ...sub, endpoint: "http://push.example.com/x" }],
        ["URL olmayan endpoint", { ...sub, endpoint: "abc" }],
        ["anahtarsız abonelik", { endpoint: sub.endpoint }],
        ["boş auth anahtarı", { ...sub, keys: { ...sub.keys, auth: "" } }],
        ["base64url olmayan anahtar (TextDecoder çıktısı)", { ...sub, keys: { ...sub.keys, p256dh: "\u0004�r" } }],
        ["null", null],
    ])("geçersiz girdi (%s) → { success: false }, DB'ye dokunmaz", async (_label, input) => {
        await expect(subscribeUser(input as any)).resolves.toEqual({ success: false });
        expect(db.pushSubscription.upsert).not.toHaveBeenCalled();
    });

    it.each([
        "https://10.0.0.5/admin",
        "https://localhost/x",
        "https://attacker.example/1",
        "https://fcm.googleapis.com.evil.example/x",
        "https://evilfcm.googleapis.com/x",
        "https://user@fcm.googleapis.com:8443/x",
    ])("bilinen push servisi olmayan endpoint (%s) reddedilir (sunucu oraya istek atmamalı)", async (endpoint) => {
        await expect(subscribeUser({ ...sub, endpoint })).resolves.toEqual({ success: false });
        expect(db.pushSubscription.upsert).not.toHaveBeenCalled();
    });

    it.each([
        "https://fcm.googleapis.com/fcm/send/abc",
        "https://updates.push.services.mozilla.com/wpush/v2/abc",
        "https://wns2-db5p.notify.windows.com/w/?token=abc",
        "https://web.push.apple.com/abc",
    ])("bilinen push servisi (%s) kabul edilir", async (endpoint) => {
        await expect(subscribeUser({ ...sub, endpoint })).resolves.toEqual({ success: true });
    });

    it("profil başına en fazla 10 abonelik tutar; en eskileri siler", async () => {
        db.pushSubscription.findMany.mockResolvedValue([{ id: "old-1" }, { id: "old-2" }]);
        await expect(subscribeUser(sub)).resolves.toEqual({ success: true });
        expect(db.pushSubscription.findMany).toHaveBeenCalledWith({
            where: { profileId: viewerProfile.id },
            orderBy: { createdAt: "desc" },
            skip: 10,
            select: { id: true },
        });
        expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ["old-1", "old-2"] }, profileId: viewerProfile.id },
        });
    });

    it("veritabanı hatasında { success: false } döner", async () => {
        db.pushSubscription.upsert.mockRejectedValue(new Error("db down"));
        await expect(subscribeUser(sub)).resolves.toEqual({ success: false });
    });
});

describe("unsubscribeUser", () => {
    it("başka profilin endpoint'i için yalnızca kendi kaydını hedefler ve 0 kayıt siler", async () => {
        await expect(unsubscribeUser("https://push.example.com/someone-else")).resolves.toEqual({ success: false });
        expect(db.pushSubscription.deleteMany).toHaveBeenCalledTimes(1);
        expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
            where: { endpoint: "https://push.example.com/someone-else", profileId: viewerProfile.id },
        });
    });

    it("kendi kaydını silince { success: true } döner", async () => {
        db.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
        await expect(unsubscribeUser(sub.endpoint)).resolves.toEqual({ success: true });
    });

    it("oturum yoksa veritabanına dokunmaz", async () => {
        currentProfile.mockResolvedValue(null);
        await expect(unsubscribeUser(sub.endpoint)).resolves.toEqual({ success: false });
        expect(db.pushSubscription.deleteMany).not.toHaveBeenCalled();
    });

    it("string olmayan endpoint → { success: false }", async () => {
        await expect(unsubscribeUser({} as any)).resolves.toEqual({ success: false });
        expect(db.pushSubscription.deleteMany).not.toHaveBeenCalled();
    });
});

it("herkese açık sendNotification action'ı artık yok", () => {
    expect("sendNotification" in actions).toBe(false);
});
