import { beforeEach, describe, expect, it, vi } from "vitest";
import { viewerProfile } from "../helpers/fixtures";

const auth = vi.hoisted(() => vi.fn());
const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth(), currentUser: () => currentUser() }));

const db = vi.hoisted(() => ({ profile: { findUnique: vi.fn(), create: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));

import { currentProfile } from "@/lib/current-profile";

beforeEach(() => {
    vi.clearAllMocks();
    currentUser.mockResolvedValue({ id: "user_new", firstName: "Yeni", lastName: "Kullanıcı", imageUrl: "x", emailAddresses: [{ emailAddress: "new@example.com" }] });
});

describe("currentProfile", () => {
    it("oturum yoksa null döner", async () => {
        auth.mockResolvedValue({ userId: null });
        await expect(currentProfile()).resolves.toBeNull();
        expect(db.profile.findUnique).not.toHaveBeenCalled();
    });

    it("profil yoksa null döner ve profil oluşturmaz", async () => {
        auth.mockResolvedValue({ userId: "user_new" });
        db.profile.findUnique.mockResolvedValue(null);
        await expect(currentProfile()).resolves.toBeNull();
        expect(db.profile.create).not.toHaveBeenCalled();
    });

    it("profil varsa onu döner", async () => {
        auth.mockResolvedValue({ userId: viewerProfile.userID });
        db.profile.findUnique.mockResolvedValue(viewerProfile);
        await expect(currentProfile()).resolves.toBe(viewerProfile);
        expect(db.profile.findUnique).toHaveBeenCalledWith({ where: { userID: viewerProfile.userID } });
    });
});
