// @vitest-environment node
// F-06 / İnceleme Odağı 5: DM bildirimi profilin tüm aboneliklerine gider; süresi dolmuş
// abonelik (404/410) silinir; notifyProfile hiçbir durumda hata fırlatmaz.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const webpush = vi.hoisted(() => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }));
vi.mock("web-push", () => ({ default: webpush }));

const db = vi.hoisted(() => ({ pushSubscription: { findMany: vi.fn(), deleteMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));

import { notifyProfile } from "@/lib/push";

const subA = { id: "ps-a", profileId: "p-other", endpoint: "https://push.example.com/a", p256dh: "pa", auth: "aa" };
const subB = { id: "ps-b", profileId: "p-other", endpoint: "https://push.example.com/b", p256dh: "pb", auth: "ab" };
const payload = { title: "Viewer", body: "merhaba", url: "/servers/s-1/conversations/m-viewer" };

const pushError = (statusCode: number) => Object.assign(new Error(`push ${statusCode}`), { statusCode });

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
    vi.stubEnv("VAPID_SUBJECT", "mailto:ops@example.com");
    db.pushSubscription.findMany.mockResolvedValue([subA]);
    db.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
    webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllEnvs();
    logSpy.mockRestore();
});

describe("notifyProfile", () => {
    it("yalnızca o profilin aboneliklerini okur", async () => {
        await notifyProfile("p-other", payload);
        expect(db.pushSubscription.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { profileId: "p-other" } }),
        );
    });

    it("başarılı gönderimde payload JSON.stringify({ title, body, url }) olarak gider", async () => {
        await notifyProfile("p-other", payload);
        expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
        expect(webpush.sendNotification).toHaveBeenCalledWith(
            { endpoint: subA.endpoint, keys: { p256dh: subA.p256dh, auth: subA.auth } },
            JSON.stringify({ title: payload.title, body: payload.body, url: payload.url }),
            expect.objectContaining({
                vapidDetails: { subject: "mailto:ops@example.com", publicKey: "public-key", privateKey: "private-key" },
                // Yanıt vermeyen bir push servisi bağlantıyı süresiz açık tutmamalı.
                timeout: expect.any(Number),
            }),
        );
        expect(db.pushSubscription.deleteMany).not.toHaveBeenCalled();
    });

    it.each([410, 404])("%i dönen abonelik silinir ve notifyProfile resolve olur", async (status) => {
        webpush.sendNotification.mockRejectedValue(pushError(status));
        await expect(notifyProfile("p-other", payload)).resolves.toBeUndefined();
        expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: subA.id } });
    });

    it("bir abonelik 410 dönerken diğeri yine gönderilir; yalnızca süresi dolan silinir", async () => {
        db.pushSubscription.findMany.mockResolvedValue([subA, subB]);
        webpush.sendNotification.mockImplementation(async (s: { endpoint: string }) => {
            if (s.endpoint === subA.endpoint) throw pushError(410);
            return { statusCode: 201 };
        });
        await expect(notifyProfile("p-other", payload)).resolves.toBeUndefined();
        expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
        expect(db.pushSubscription.deleteMany).toHaveBeenCalledTimes(1);
        expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: subA.id } });
    });

    it("diğer hatalarda (ör. 500) abonelik silinmez, loglanır ve resolve olur", async () => {
        webpush.sendNotification.mockRejectedValue(pushError(500));
        await expect(notifyProfile("p-other", payload)).resolves.toBeUndefined();
        expect(db.pushSubscription.deleteMany).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalled();
    });

    it("süresi dolan aboneliği silmek de başarısız olursa yine resolve olur", async () => {
        webpush.sendNotification.mockRejectedValue(pushError(410));
        db.pushSubscription.deleteMany.mockRejectedValue(new Error("db down"));
        await expect(notifyProfile("p-other", payload)).resolves.toBeUndefined();
    });

    it("abonelikler okunamazsa resolve olur", async () => {
        db.pushSubscription.findMany.mockRejectedValue(new Error("db down"));
        await expect(notifyProfile("p-other", payload)).resolves.toBeUndefined();
        expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it.each(["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"])(
        "%s tanımlı değilse gönderim yapmaz ve resolve olur",
        async (name) => {
            vi.stubEnv(name, "");
            await expect(notifyProfile("p-other", payload)).resolves.toBeUndefined();
            expect(webpush.sendNotification).not.toHaveBeenCalled();
            expect(db.pushSubscription.findMany).not.toHaveBeenCalled();
        },
    );

    it("global VAPID ayarı kullanmaz (setVapidDetails modül yüklenirken env'e bağlı kalmaz)", async () => {
        await notifyProfile("p-other", payload);
        expect(webpush.setVapidDetails).not.toHaveBeenCalled();
    });
});
