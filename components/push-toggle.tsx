"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

import { subscribeUser, unsubscribeUser } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/action-tooltip";

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

// PushSubscription.toJSON() anahtarları Web Push'un beklediği base64url biçiminde verir.
function toInput(sub: PushSubscription) {
    const json = sub.toJSON();
    return {
        endpoint: json.endpoint ?? sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    };
}

// Bu tarayıcının push aboneliğini hangi Clerk kullanıcısının açtığı. Paylaşılan cihazda
// çıkış yapan ya da hesap değiştiren kullanıcının bildirimleri sonraki kişiye gelmesin.
export const PUSH_OWNER_KEY = "vault-push-owner";

const readOwner = () => {
    try {
        return localStorage.getItem(PUSH_OWNER_KEY);
    } catch {
        return null;
    }
};

const writeOwner = (userId: string | null) => {
    try {
        if (userId) localStorage.setItem(PUSH_OWNER_KEY, userId);
        else localStorage.removeItem(PUSH_OWNER_KEY);
    } catch {
        // Depolama kapalıysa sahip bilinmez; abonelik sonraki açılışta kaldırılır.
    }
};

const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

// Oturumdaki kullanıcıya ait değilse bu tarayıcının aboneliğini kaldırır. Tarayıcıda
// kaldırılan abonelik push servisinde de geçersizleşir; sunucudaki eski kayıt ilk
// gönderimde 404/410 alınca silinir (lib/push.ts).
async function dropForeignSubscription(userId: string | null): Promise<boolean> {
    const registration = await navigator.serviceWorker.getRegistration?.("/");
    const existing = await registration?.pushManager.getSubscription();
    if (!existing || (userId && readOwner() === userId)) {
        return false;
    }
    await existing.unsubscribe();
    writeOwner(null);
    return true;
}

/** Kök layout'ta durur: oturum kapanınca ya da hesap değişince eski aboneliği kaldırır. */
export const PushSessionGuard = () => {
    const { isLoaded, userId } = useAuth();

    useEffect(() => {
        if (!isLoaded || !pushSupported()) {
            return;
        }
        dropForeignSubscription(userId ?? null).catch((error) => console.log("[PUSH_GUARD]", error));
    }, [isLoaded, userId]);

    return null;
};

export const PushToggle = () => {
    const { userId } = useAuth();
    const [supported, setSupported] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!pushSupported() || !userId) {
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const registration = await navigator.serviceWorker.register("/sw.js", {
                    scope: "/",
                    updateViaCache: "none",
                });
                let existing = await registration.pushManager.getSubscription();
                if (cancelled) return;
                setSupported(true);
                if (!existing) return;
                // Başka (ya da bilinmeyen) bir hesabın aboneliği bu hesaba bağlanmaz, kaldırılır.
                if (readOwner() !== userId) {
                    await existing.unsubscribe();
                    writeOwner(null);
                    return;
                }
                // Kendi aboneliği: anahtarlar sunucuyla eşitlenir; reddedilirse kapalı görünür.
                const { success } = await subscribeUser(toInput(existing));
                if (!success) existing = null;
                if (!cancelled) setSubscription(existing);
            } catch (error) {
                console.log("[PUSH_REGISTER]", error);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    async function enable() {
        setBusy(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
            });
            const { success } = await subscribeUser(toInput(sub));
            if (success) {
                writeOwner(userId ?? null);
                setSubscription(sub);
            } else {
                await sub.unsubscribe();
            }
        } catch (error) {
            console.log("[PUSH_SUBSCRIBE]", error);
        } finally {
            setBusy(false);
        }
    }

    async function disable() {
        if (!subscription) return;
        setBusy(true);
        try {
            const { endpoint } = subscription;
            await subscription.unsubscribe();
            writeOwner(null);
            setSubscription(null);
            await unsubscribeUser(endpoint);
        } catch (error) {
            console.log("[PUSH_UNSUBSCRIBE]", error);
        } finally {
            setBusy(false);
        }
    }

    if (!supported) {
        return null;
    }

    const label = subscription ? "Bildirimleri kapat" : "Bildirimleri aç";
    return (
        <ActionTooltip side="right" align="center" label={label}>
            <Button
                className="bg-transparent border-0"
                variant="outline"
                size="icon"
                aria-label={label}
                disabled={busy}
                onClick={subscription ? disable : enable}
            >
                {subscription ? <Bell className="h-[1.2rem] w-[1.2rem]" /> : <BellOff className="h-[1.2rem] w-[1.2rem]" />}
            </Button>
        </ActionTooltip>
    );
};
