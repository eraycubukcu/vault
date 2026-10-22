// F-02 istemci: sohbet açılınca sunucudan odaya katılma istenir, kapanınca ayrılınır;
// yeniden bağlanınca tekrar katılınır; yalnızca bu hook'un dinleyicileri kaldırılır.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

type Handler = (...args: any[]) => void;

function fakeSocket() {
    const listeners = new Map<string, Set<Handler>>();
    return {
        connected: true,
        emit: vi.fn(),
        on: vi.fn((event: string, handler: Handler) => {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event)!.add(handler);
        }),
        off: vi.fn((event: string, handler?: Handler) => {
            if (handler) listeners.get(event)?.delete(handler);
            else listeners.delete(event);
        }),
        trigger(event: string, ...args: unknown[]) {
            listeners.get(event)?.forEach((handler) => handler(...args));
        },
        count: (event: string) => listeners.get(event)?.size ?? 0,
    };
}

let socket: ReturnType<typeof fakeSocket>;
vi.mock("@/components/ui/providers/socket-provider", () => ({ useSocket: () => ({ socket, isConnected: true }) }));

import { useChatSocket } from "@/hooks/use-chat-socket";

const props = { chatId: "c1", queryKey: "chat:c1", addKey: "chat:c1:messages", updateKey: "chat:c1:messages:update" };

function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const joinCalls = () => socket.emit.mock.calls.filter(([event]) => event === "chat:join");

beforeEach(() => {
    socket = fakeSocket();
});

describe("useChatSocket oda üyeliği", () => {
    it("mount olunca chat:join gönderir", () => {
        renderHook(() => useChatSocket(props), { wrapper });
        expect(joinCalls()).toHaveLength(1);
        expect(joinCalls()[0][1]).toBe("c1");
        expect(joinCalls()[0][2]).toEqual(expect.any(Function));
    });

    it("unmount olunca chat:leave gönderir", () => {
        const { unmount } = renderHook(() => useChatSocket(props), { wrapper });
        unmount();
        expect(socket.emit).toHaveBeenCalledWith("chat:leave", "c1");
    });

    it("yeniden bağlanınca (connect) tekrar chat:join gönderir", () => {
        renderHook(() => useChatSocket(props), { wrapper });
        socket.trigger("connect");
        expect(joinCalls()).toHaveLength(2);
        expect(joinCalls()[1][1]).toBe("c1");
    });

    it("unmount yalnızca kendi dinleyicilerini kaldırır", () => {
        const other = vi.fn();
        socket.on(props.addKey, other);
        const { unmount } = renderHook(() => useChatSocket(props), { wrapper });
        expect(socket.count(props.addKey)).toBe(2);
        unmount();
        expect(socket.count(props.addKey)).toBe(1);
        expect(socket.count("connect")).toBe(0);
        socket.trigger(props.addKey, { id: "x" });
        expect(other).toHaveBeenCalledTimes(1);
    });

    it("sohbet değişince eskisinden ayrılıp yenisine katılır", () => {
        const { rerender } = renderHook((p) => useChatSocket(p), { wrapper, initialProps: props });
        rerender({ chatId: "c2", queryKey: "chat:c2", addKey: "chat:c2:messages", updateKey: "chat:c2:messages:update" });
        expect(socket.emit).toHaveBeenCalledWith("chat:leave", "c1");
        expect(joinCalls().map(([, id]) => id)).toEqual(["c1", "c2"]);
    });
});
