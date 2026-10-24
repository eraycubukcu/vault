"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

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

export const PushToggle = () => {
    const [supported, setSupported] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const registration = await navigator.serviceWorker.register("/sw.js", {
                    scope: "/",
                    updateViaCache: "none",
                });
                const existing = await registration.pushManager.getSubscription();
                if (cancelled) return;
                setSupported(true);
                setSubscription(existing);
                // Tarayıcıdaki abonelik (ör. aynı cihazda başka hesaptan kalmış) oturumdaki profile bağlanır.
                if (existing) {
                    await subscribeUser(toInput(existing));
                }
            } catch (error) {
                console.log("[PUSH_REGISTER]", error);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

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
