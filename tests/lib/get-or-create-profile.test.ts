import { beforeEach, describe, expect, it, vi } from "vitest";
import { viewerProfile } from "../helpers/fixtures";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ currentUser: () => currentUser() }));

const redirect = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT ${url}`); }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

const db = vi.hoisted(() => ({ profile: { findUnique: vi.fn(), create: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));

import { getOrCreateProfile } from "@/lib/get-or-create-profile";

const clerkUser = { id: "user_new", firstName: "Yeni", lastName: "Kullanıcı", imageUrl: "img", emailAddresses: [{ emailAddress: "new@example.com" }] };

beforeEach(() => vi.clearAllMocks());

describe("getOrCreateProfile", () => {
    it("oturum yoksa /home'a yönlendirir", async () => {
        currentUser.mockResolvedValue(null);
        await expect(getOrCreateProfile()).rejects.toThrow("NEXT_REDIRECT /home");
        expect(db.profile.create).not.toHaveBeenCalled();
    });

    it("profil varsa oluşturmadan döner", async () => {
        currentUser.mockResolvedValue(clerkUser);
        db.profile.findUnique.mockResolvedValue(viewerProfile);
        await expect(getOrCreateProfile()).resolves.toBe(viewerProfile);
        expect(db.profile.create).not.toHaveBeenCalled();
    });

    it("profil yoksa Clerk bilgileriyle oluşturur", async () => {
        currentUser.mockResolvedValue(clerkUser);
        db.profile.findUnique.mockResolvedValue(null);
        db.profile.create.mockImplementation(({ data }) => Promise.resolve({ id: "p-new", ...data }));
        const profile = await getOrCreateProfile();
        expect(db.profile.create).toHaveBeenCalledWith({
            data: { userID: "user_new", name: "Yeni Kullanıcı", imageUrl: "img", email: "new@example.com" },
        });
        expect(profile.id).toBe("p-new");
    });
});
