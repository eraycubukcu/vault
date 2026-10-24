// F-06 istemci: abonelik sunucuya sub.toJSON() ile (base64url anahtarlar) gönderilir;
// abonelikten çıkış yalnızca bu tarayıcının endpoint'ini siler.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const subscribeUser = vi.hoisted(() => vi.fn());
const unsubscribeUser = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions", () => ({ subscribeUser, unsubscribeUser }));

const auth = vi.hoisted(() => ({ userId: "user_b" as string | null | undefined, isLoaded: true }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => auth }));

import { PUSH_OWNER_KEY, PushSessionGuard, PushToggle } from "@/components/push-toggle";

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
        value: {
            register: vi.fn(async () => registration),
            getRegistration: vi.fn(async () => registration),
            ready: Promise.resolve(registration),
        },
    });
    (window as any).PushManager = function PushManager() {};
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U");
    browserSub = null;
    auth.userId = "user_b";
    auth.isLoaded = true;
    localStorage.clear();
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

    it("abone olunca bu tarayıcının aboneliğini oturumdaki kullanıcıya ait olarak işaretler", async () => {
        render(<PushToggle />);
        fireEvent.click(await screen.findByRole("button", { name: "Bildirimleri aç" }));
        await screen.findByRole("button", { name: "Bildirimleri kapat" });
        expect(localStorage.getItem(PUSH_OWNER_KEY)).toBe("user_b");
    });

    it("kendi mevcut aboneliğini sunucuyla eşitler; kapatınca tarayıcıdan ve sunucudan bu endpoint'i siler", async () => {
        browserSub = makeSub();
        localStorage.setItem(PUSH_OWNER_KEY, "user_b");
        render(<PushToggle />);
        fireEvent.click(await screen.findByRole("button", { name: "Bildirimleri kapat" }));
        await waitFor(() => expect(unsubscribeUser).toHaveBeenCalledWith(json.endpoint));
        expect(browserSub.unsubscribe).toHaveBeenCalled();
        await screen.findByRole("button", { name: "Bildirimleri aç" });
        expect(subscribeUser).toHaveBeenCalledWith({ endpoint: json.endpoint, keys: json.keys });
        expect(localStorage.getItem(PUSH_OWNER_KEY)).toBeNull();
    });

    it("başka hesaptan kalmış tarayıcı aboneliğini yeni hesaba bağlamaz, kaldırır", async () => {
        browserSub = makeSub();
        localStorage.setItem(PUSH_OWNER_KEY, "user_a");
        render(<PushToggle />);
        await screen.findByRole("button", { name: "Bildirimleri aç" });
        await waitFor(() => expect(browserSub.unsubscribe).toHaveBeenCalled());
        expect(subscribeUser).not.toHaveBeenCalled();
    });

    it("sahibi bilinmeyen tarayıcı aboneliğini de bağlamaz, kaldırır", async () => {
        browserSub = makeSub();
        render(<PushToggle />);
        await screen.findByRole("button", { name: "Bildirimleri aç" });
        await waitFor(() => expect(browserSub.unsubscribe).toHaveBeenCalled());
        expect(subscribeUser).not.toHaveBeenCalled();
    });

    it("açılıştaki eşitlemeyi sunucu reddederse kapalı gösterir", async () => {
        browserSub = makeSub();
        localStorage.setItem(PUSH_OWNER_KEY, "user_b");
        subscribeUser.mockResolvedValue({ success: false });
        render(<PushToggle />);
        await waitFor(() => expect(subscribeUser).toHaveBeenCalled());
        await screen.findByRole("button", { name: "Bildirimleri aç" });
    });

    it("tarayıcı push desteklemiyorsa hiçbir şey göstermez", async () => {
        delete (window as any).PushManager;
        const { container } = render(<PushToggle />);
        await new Promise((r) => setTimeout(r, 0));
        expect(container).toBeEmptyDOMElement();
    });
});

describe("PushSessionGuard", () => {
    it("oturum kapanınca bu tarayıcının push aboneliğini kaldırır (paylaşılan cihaz)", async () => {
        browserSub = makeSub();
        localStorage.setItem(PUSH_OWNER_KEY, "user_b");
        const { rerender } = render(<PushSessionGuard />);
        await new Promise((r) => setTimeout(r, 0));
        expect(browserSub.unsubscribe).not.toHaveBeenCalled();

        auth.userId = null;
        rerender(<PushSessionGuard />);
        await waitFor(() => expect(browserSub.unsubscribe).toHaveBeenCalled());
        expect(localStorage.getItem(PUSH_OWNER_KEY)).toBeNull();
    });

    it("başka bir hesaba geçilince eski hesabın tarayıcı aboneliğini kaldırır", async () => {
        browserSub = makeSub();
        localStorage.setItem(PUSH_OWNER_KEY, "user_a");
        render(<PushSessionGuard />);
        await waitFor(() => expect(browserSub.unsubscribe).toHaveBeenCalled());
    });

    it("Clerk yüklenmeden karar vermez", async () => {
        browserSub = makeSub();
        localStorage.setItem(PUSH_OWNER_KEY, "user_b");
        auth.isLoaded = false;
        auth.userId = undefined;
        render(<PushSessionGuard />);
        await new Promise((r) => setTimeout(r, 0));
        expect(browserSub.unsubscribe).not.toHaveBeenCalled();
    });
});
