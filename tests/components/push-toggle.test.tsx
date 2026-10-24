// F-06 istemci: abonelik sunucuya sub.toJSON() ile (base64url anahtarlar) gönderilir;
// abonelikten çıkış yalnızca bu tarayıcının endpoint'ini siler.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const subscribeUser = vi.hoisted(() => vi.fn());
const unsubscribeUser = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions", () => ({ subscribeUser, unsubscribeUser }));

import { PushToggle } from "@/components/push-toggle";

const json = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    expirationTime: null,
    keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u", auth: "tBHItJI5svbpez7KI4CCXg" },
};

let browserSub: any;
let pushManager: any;

function makeSub() {
    return {
        endpoint: json.endpoint,
        toJSON: () => json,
        // Eski kod bunları TextDecoder ile çözüyordu; artık kullanılmamalı.
        getKey: vi.fn(() => new Uint8Array([4, 200, 13]).buffer),
        unsubscribe: vi.fn(async () => true),
    };
}

function installServiceWorker() {
    pushManager = {
        getSubscription: vi.fn(async () => browserSub),
        subscribe: vi.fn(async () => {
            browserSub = makeSub();
            return browserSub;
        }),
    };
    const registration = { pushManager };
    Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: { register: vi.fn(async () => registration), ready: Promise.resolve(registration) },
    });
    (window as any).PushManager = function PushManager() {};
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U");
    browserSub = null;
    subscribeUser.mockResolvedValue({ success: true });
    unsubscribeUser.mockResolvedValue({ success: true });
    installServiceWorker();
});

afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    delete (navigator as any).serviceWorker;
    delete (window as any).PushManager;
});

describe("PushToggle", () => {
    it("service worker'ı /sw.js olarak kaydeder", async () => {
        render(<PushToggle />);
        await screen.findByRole("button", { name: "Bildirimleri aç" });
        expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/sw.js", expect.objectContaining({ scope: "/" }));
    });

    it("abone olunca sunucuya sub.toJSON()'daki endpoint ve anahtarları gönderir", async () => {
        render(<PushToggle />);
        fireEvent.click(await screen.findByRole("button", { name: "Bildirimleri aç" }));
        await waitFor(() => expect(subscribeUser).toHaveBeenCalledTimes(1));
        expect(subscribeUser).toHaveBeenCalledWith({ endpoint: json.endpoint, keys: json.keys });
        expect(browserSub.getKey).not.toHaveBeenCalled();
        expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
        await screen.findByRole("button", { name: "Bildirimleri kapat" });
    });

    it("sunucu aboneliği reddederse tarayıcı aboneliğini de geri alır", async () => {
        subscribeUser.mockResolvedValue({ success: false });
        render(<PushToggle />);
        fireEvent.click(await screen.findByRole("button", { name: "Bildirimleri aç" }));
        await waitFor(() => expect(browserSub.unsubscribe).toHaveBeenCalled());
        await screen.findByRole("button", { name: "Bildirimleri aç" });
    });

    it("izin reddedilirse (subscribe hata verir) kapalı kalır ve sunucuya istek atmaz", async () => {
        pushManager.subscribe.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
        render(<PushToggle />);
        fireEvent.click(await screen.findByRole("button", { name: "Bildirimleri aç" }));
        await waitFor(() => expect(pushManager.subscribe).toHaveBeenCalled());
        await screen.findByRole("button", { name: "Bildirimleri aç" });
        expect(subscribeUser).not.toHaveBeenCalled();
    });

    it("mevcut aboneliği sunucuyla eşitler; kapatınca tarayıcıdan ve sunucudan bu endpoint'i siler", async () => {
        browserSub = makeSub();
        render(<PushToggle />);
        fireEvent.click(await screen.findByRole("button", { name: "Bildirimleri kapat" }));
        await waitFor(() => expect(unsubscribeUser).toHaveBeenCalledWith(json.endpoint));
        expect(browserSub.unsubscribe).toHaveBeenCalled();
        await screen.findByRole("button", { name: "Bildirimleri aç" });
        // Açılışta var olan abonelik (ör. başka hesaptan kalmış) mevcut profile bağlanır.
        expect(subscribeUser).toHaveBeenCalledWith({ endpoint: json.endpoint, keys: json.keys });
    });

    it("tarayıcı push desteklemiyorsa hiçbir şey göstermez", async () => {
        delete (window as any).PushManager;
        const { container } = render(<PushToggle />);
        await new Promise((r) => setTimeout(r, 0));
        expect(container).toBeEmptyDOMElement();
    });
});
