// @vitest-environment node
// Paket 4 regresyonu: SocketProvider root layout'ta olduğu için sunucuda da render edilir.
// <ClerkProvider dynamic> olmadan Clerk'in useAuth()'u sunucuda "static mode" hatası fırlatır.
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

const STATIC_MODE_ERROR =
    "Clerk: useAuth() called in static mode, wrap this component in <ClerkProvider dynamic> to make auth data available during server-side rendering.";

// @clerk/nextjs'in usePromisifiedAuth davranışını taklit eder: window yoksa (SSR) ve
// dynamic auth verisi yoksa fırlatır.
const useAuth = vi.hoisted(() => vi.fn(() => {
    if (typeof window === "undefined") {
        throw new Error(STATIC_MODE_ERROR);
    }
    return { isSignedIn: true, getToken: async () => "t" };
}));
vi.mock("@clerk/nextjs", () => ({ useAuth }));

const ioMock = vi.hoisted(() => vi.fn());
vi.mock("socket.io-client", () => ({ io: ioMock }));

import { SocketProvider } from "@/components/ui/providers/socket-provider";

describe("SocketProvider (SSR)", () => {
    it("ClerkProvider dynamic olmadan sunucuda render edilebilir ve children'ı basar", () => {
        expect(typeof window).toBe("undefined");
        const html = renderToString(<SocketProvider><p>içerik</p></SocketProvider>);
        expect(html).toContain("içerik");
        expect(ioMock).not.toHaveBeenCalled();
    });
});
