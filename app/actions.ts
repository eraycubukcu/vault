"use server";

import { z } from "zod";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

// Sunucu her DM'de abonelik adresine istek atar; bu yüzden yalnızca tarayıcıların
// push servislerine izin verilir (aksi hâlde iç ağa ya da rastgele adreslere istek atılabilir).
const PUSH_HOSTS = [
    /^fcm\.googleapis\.com$/,
    /^android\.googleapis\.com$/,
    /^updates\.push\.services\.mozilla\.com$/,
    /^[a-z0-9-]+\.notify\.windows\.com$/,
    /^web\.push\.apple\.com$/,
    /^[a-z0-9-]+\.push\.apple\.com$/,
];
const MAX_SUBSCRIPTIONS_PER_PROFILE = 10;

const isPushServiceUrl = (value: string) => {
    try {
        const url = new URL(value);
        return (
            url.protocol === "https:" &&
            url.port === "" &&
            url.username === "" &&
            url.password === "" &&
            PUSH_HOSTS.some((host) => host.test(url.hostname))
        );
    } catch {
        return false;
    }
};

// Server action'lar dışarıdan her türlü veriyle çağrılabilir; şekli burada doğrulanır.
const base64url = z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+={0,2}$/);
const subscriptionSchema = z.object({
    endpoint: z.string().max(2048).refine(isPushServiceUrl),
    keys: z.object({ p256dh: base64url, auth: base64url }),
});

export type PushSubscriptionInput = z.infer<typeof subscriptionSchema>;

/** Bu tarayıcının aboneliğini oturumdaki profile bağlar (endpoint başına tek kayıt). */
export async function subscribeUser(sub: PushSubscriptionInput): Promise<{ success: boolean }> {
    try {
        const profile = await currentProfile();
        const parsed = subscriptionSchema.safeParse(sub);
        if (!profile || !parsed.success) {
            return { success: false };
        }
        const { endpoint, keys } = parsed.data;
        await db.pushSubscription.upsert({
            where: { endpoint },
            create: { profileId: profile.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
            update: { profileId: profile.id, p256dh: keys.p256dh, auth: keys.auth },
        });
        // Profil başına abonelik sayısı sınırlı: en yeni MAX_SUBSCRIPTIONS_PER_PROFILE kayıt kalır.
        const stale = await db.pushSubscription.findMany({
            where: { profileId: profile.id },
            orderBy: { createdAt: "desc" },
            skip: MAX_SUBSCRIPTIONS_PER_PROFILE,
            select: { id: true },
        });
        if (stale.length > 0) {
            await db.pushSubscription.deleteMany({
                where: { id: { in: stale.map((row) => row.id) }, profileId: profile.id },
            });
        }
        return { success: true };
    } catch (error) {
        console.log("[PUSH_SUBSCRIBE]", error);
        return { success: false };
    }
}

/** Yalnızca oturumdaki profilin bu endpoint'e ait kaydını siler. */
export async function unsubscribeUser(endpoint: string): Promise<{ success: boolean }> {
    try {
        const profile = await currentProfile();
        if (!profile || typeof endpoint !== "string") {
            return { success: false };
        }
        const { count } = await db.pushSubscription.deleteMany({
            where: { endpoint, profileId: profile.id },
        });
        return { success: count > 0 };
    } catch (error) {
        console.log("[PUSH_UNSUBSCRIBE]", error);
        return { success: false };
    }
}
