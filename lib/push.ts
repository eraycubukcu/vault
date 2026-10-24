import "server-only";

import webpush from "web-push";
import { db } from "@/lib/db";

export type PushPayload = { title: string; body: string; url: string };

// VAPID ayarları her çağrıda env'den okunur: modül yüklenirken (ör. build sırasında)
// anahtar yoksa hata fırlatmaz, yalnızca bildirim gönderilmez.
function vapidDetails() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
        return null;
    }
    return { subject, publicKey, privateKey };
}

// Yanıt vermeyen bir push servisi DM isteğinin arkasında bağlantı biriktirmesin.
const SEND_TIMEOUT_MS = 10_000;

// Push servisi bu yanıtları "abonelik artık yok" anlamında döner.
const isGone = (error: unknown) => {
    const status = (error as { statusCode?: number } | null)?.statusCode;
    return status === 404 || status === 410;
};

/** Profilin tüm aboneliklerine bildirim gönderir. Süresi dolanları siler; asla hata fırlatmaz. */
export async function notifyProfile(profileId: string, payload: PushPayload): Promise<void> {
    const vapid = vapidDetails();
    if (!vapid) {
        console.log("[PUSH] VAPID ayarları eksik; bildirim gönderilmedi");
        return;
    }
    try {
        const subscriptions = await db.pushSubscription.findMany({
            where: { profileId },
            select: { id: true, endpoint: true, p256dh: true, auth: true },
        });
        const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url });

        await Promise.all(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        body,
                        { vapidDetails: vapid, TTL: 60 * 60, timeout: SEND_TIMEOUT_MS },
                    );
                } catch (error) {
                    if (!isGone(error)) {
                        console.log("[PUSH_SEND]", error);
                        return;
                    }
                    await db.pushSubscription
                        .deleteMany({ where: { id: sub.id } })
                        .catch((deleteError) => console.log("[PUSH_DELETE]", deleteError));
                }
            }),
        );
    } catch (error) {
        console.log("[PUSH]", error);
    }
}
