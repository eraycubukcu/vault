// F-03 istemci: MediaRoom token'ı yalnızca oda kimliğiyle ister; kimlik bilgisi göndermez.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Track } from "livekit-client";

// Clerk'ten ad okunursa test bunu görsün: MediaRoom artık useUser'a bağlı olmamalı.
const useUser = vi.hoisted(() => vi.fn(() => ({ user: { firstName: "Sahte", lastName: "Ad" } })));
vi.mock("@clerk/nextjs", () => ({ useUser }));

vi.mock("@livekit/components-react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@livekit/components-react")>()),
    LiveKitRoom: ({ token }: { token: string }) => <div data-testid="lk-room" data-token={token} />,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { canPublishCamera, MediaRoom } from "@/components/media-room";

beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: "jwt-1" }), { status: 200 }));
});

afterEach(() => {
    cleanup();
});

describe("MediaRoom", () => {
    it("token'ı yalnızca room parametresiyle ister, username göndermez", async () => {
        render(<MediaRoom chatId="c-1" video={false} audio />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(fetchMock.mock.calls[0][0]).toBe("/api/livekit?room=c-1");
        expect(await screen.findByTestId("lk-room")).toHaveAttribute("data-token", "jwt-1");
    });

    it("Clerk kullanıcısının adı olmasa da token ister", async () => {
        useUser.mockReturnValue({ user: { firstName: null, lastName: null } } as any);
        render(<MediaRoom chatId="c-1" video={false} audio />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });

    it("oda kimliğini URL için kodlar", async () => {
        render(<MediaRoom chatId="a&username=x" video audio />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(fetchMock.mock.calls[0][0]).toBe("/api/livekit?room=a%26username%3Dx");
    });

    it("403 gelirse sonsuz yükleme yerine erişim hatası gösterir", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }));
        render(<MediaRoom chatId="c-1" video={false} audio />);
        expect(await screen.findByText("Bu odaya erişiminiz yok")).toBeInTheDocument();
        expect(screen.queryByTestId("lk-room")).not.toBeInTheDocument();
    });

    it("sunucu hatasında bağlanılamadı mesajı gösterir", async () => {
        fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
        render(<MediaRoom chatId="c-1" video={false} audio />);
        expect(await screen.findByText("Odaya bağlanılamadı")).toBeInTheDocument();
    });

    it("sohbet değişince önceki odanın geç gelen token'ını kullanmaz", async () => {
        let resolveFirst!: (r: Response) => void;
        fetchMock
            .mockReturnValueOnce(new Promise<Response>((r) => { resolveFirst = r; }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ token: "jwt-2" }), { status: 200 }));
        const { rerender } = render(<MediaRoom chatId="c-1" video audio />);
        rerender(<MediaRoom chatId="c-2" video audio />);
        expect(await screen.findByTestId("lk-room")).toHaveAttribute("data-token", "jwt-2");
        resolveFirst(new Response(JSON.stringify({ token: "jwt-1" }), { status: 200 }));
        await new Promise((r) => setTimeout(r, 0));
        expect(screen.getByTestId("lk-room")).toHaveAttribute("data-token", "jwt-2");
    });
});

describe("canPublishCamera", () => {
    const camera = Track.sourceToProto(Track.Source.Camera);
    const mic = Track.sourceToProto(Track.Source.Microphone);
    const screenShare = Track.sourceToProto(Track.Source.ScreenShare);

    it("izin bilgisi yoksa ya da yayın kapalıysa false", () => {
        expect(canPublishCamera(undefined)).toBe(false);
        expect(canPublishCamera({ canPublish: false, canPublishSources: [] } as any)).toBe(false);
    });

    it("kaynak listesi boşsa (tüm kaynaklar serbest) true", () => {
        expect(canPublishCamera({ canPublish: true, canPublishSources: [] } as any)).toBe(true);
    });

    it("kaynak listesinde kamera yoksa false, varsa true", () => {
        expect(canPublishCamera({ canPublish: true, canPublishSources: [mic, screenShare] } as any)).toBe(false);
        expect(canPublishCamera({ canPublish: true, canPublishSources: [camera, mic] } as any)).toBe(true);
    });
});
