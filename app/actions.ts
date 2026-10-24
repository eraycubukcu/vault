"use server";

import { z } from "zod";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

// Server action'lar dışarıdan her türlü veriyle çağrılabilir; şekli burada doğrulanır.
const base64url = z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+={0,2}$/);
const subscriptionSchema = z.object({
    endpoint: z.string().max(2048).url().refine((value) => value.startsWith("https://")),
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
