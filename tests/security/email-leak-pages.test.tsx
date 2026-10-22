// Server component'lerin client component'lere geçtiği prop'larda başkasının
// e-postası olmamalı; kullanıcı members modal'da kendi e-postasını görmeye devam etmeli.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { projecting } from "../helpers/prisma-fake";
import { OTHER_EMAIL, OTHER_USER_ID, VIEWER_EMAIL, conversation, otherMember, server, viewerMember, viewerProfile } from "../helpers/fixtures";

const db = vi.hoisted(() => ({
    server: { findUnique: vi.fn() },
    member: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/current-profile", () => ({ currentProfile: vi.fn(async () => viewerProfile) }));
vi.mock("next/navigation", () => ({
    redirect: (url: string) => { throw new Error(`NEXT_REDIRECT ${url}`); },
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
    useParams: () => ({}),
}));
vi.mock("@clerk/nextjs", () => ({ RedirectToSignIn: () => null }));
vi.mock("@/components/media-room", () => ({ MediaRoom: () => null }));

import { ServerSidebar } from "@/components/server/server-sidebar";
import { ServerHeader } from "@/components/server/server-header";
import MemberIdPage from "@/app/(main)/(routes)/servers/[serverId]/conversations/[memberId]/page";

/** Ağacı dolaşıp her elementin prop'larını (children hariç) toplar. */
function collectProps(node: ReactNode, out: { type: unknown; props: Record<string, unknown> }[] = []) {
    if (Array.isArray(node)) {
        node.forEach((child) => collectProps(child, out));
    } else if (isValidElement(node)) {
        const { children, ...rest } = node.props as Record<string, unknown>;
        out.push({ type: node.type, props: rest });
        collectProps(children as ReactNode, out);
    }
    return out;
}

const serialize = (value: unknown) => JSON.stringify(value, (_key, v) => (typeof v === "function" ? undefined : v));

beforeEach(() => {
    vi.clearAllMocks();
    db.server.findUnique.mockImplementation(projecting(server));
    db.member.findFirst.mockImplementation(projecting(viewerMember));
    db.conversation.findFirst.mockImplementation(projecting(conversation));
});

describe("ServerSidebar", () => {
    it("client component'lere başka üyenin e-postasını geçmez", async () => {
        const tree = await ServerSidebar({ serverId: "s-1" });
        const props = collectProps(tree);
        const text = serialize(props.map((p) => p.props));
        expect(text).toContain("Other");
        expect(text).not.toContain(OTHER_EMAIL);
        expect(text).not.toContain(OTHER_USER_ID);
    });

    it("members modal'a giden sunucuda kullanıcının kendi e-postası bulunur", async () => {
        const tree = await ServerSidebar({ serverId: "s-1" });
        const header = collectProps(tree).find((p) => p.type === ServerHeader)!;
        const members = (header.props.server as typeof server).members;
        expect(members.find((m) => m.id === viewerMember.id)!.profile.email).toBe(VIEWER_EMAIL);
        expect(members.find((m) => m.id === otherMember.id)!.profile).not.toHaveProperty("email");
    });
});

describe("özel sohbet sayfası", () => {
    it("client component'lere karşı tarafın e-postasını geçmez", async () => {
        const tree = await MemberIdPage({
            params: Promise.resolve({ serverId: "s-1", memberId: otherMember.id }),
            searchParams: Promise.resolve({}),
        });
        const text = serialize(collectProps(tree as ReactNode).map((p) => p.props));
        expect(text).toContain("Other");
        expect(text).not.toContain(OTHER_EMAIL);
        expect(text).not.toContain(OTHER_USER_ID);
    });
});
