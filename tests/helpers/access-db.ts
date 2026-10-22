// Erişim sorgularının `where` koşullarını gerçekten değerlendiren bellek içi sahte DB.
// Böylece testler yalnızca mock'un ne döndürdüğünü değil, yetki koşulunun kendisini doğrular.
import { vi } from "vitest";
import { channel, conversation, otherMember, server, viewerMember } from "./fixtures";

const createdAt = new Date("2026-01-01T00:00:00Z");

export const outsiderProfileId = "p-outsider";

// Dışarıdaki kişi başka bir sunucunun üyesi: "herhangi bir üyeliği var mı" hatasını yakalamak için.
export const outsiderMember = {
    id: "m-outsider",
    role: "ADMIN" as const,
    profileId: outsiderProfileId,
    serverId: "s-2",
    createdAt,
    updatedAt: createdAt,
};

// Görüntüleyenin üye olmadığı sunucudaki kanal.
export const foreignChannel = {
    id: "c-2", name: "general", type: "TEXT" as const, profileId: outsiderProfileId, serverId: "s-2", createdAt, updatedAt: createdAt,
};

const stripProfile = <M extends { profile?: unknown }>({ profile: _profile, ...member }: M) => member;

export const accessData = {
    channels: [channel, foreignChannel],
    members: [stripProfile(viewerMember), stripProfile(otherMember), outsiderMember],
    conversations: [{ id: conversation.id, memberOneId: conversation.memberOneId, memberTwoId: conversation.memberTwoId }],
};

// Sunucu sahipleri: `member.findFirst({ where: { server: { profileId } } })` ilişki filtresi için.
const serverOwners: Record<string, string> = { [server.id]: server.profileId, [foreignChannel.serverId]: outsiderProfileId };

const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
        if (key === "server") {
            const { profileId, ...rest } = value as { profileId?: string };
            if (Object.keys(rest).length) throw new Error(`sahte DB bu server alanlarını desteklemiyor: ${Object.keys(rest)}`);
            return profileId === undefined || serverOwners[row.serverId as string] === profileId;
        }
        return row[key] === value;
    });

const memberById = (id: string) => accessData.members.find((m) => m.id === id)!;

type MemberFilter = { memberOne?: { profileId: string }; memberTwo?: { profileId: string } };

const conversationMatches = (conv: (typeof accessData.conversations)[number], filter: MemberFilter) =>
    (!filter.memberOne || memberById(conv.memberOneId).profileId === filter.memberOne.profileId) &&
    (!filter.memberTwo || memberById(conv.memberTwoId).profileId === filter.memberTwo.profileId);

/** `db` mock'una erişim sorgularının bellek içi uygulamalarını bağlar. */
export function installAccessDb(db: {
    channel: { findUnique: ReturnType<typeof vi.fn> };
    member: { findFirst: ReturnType<typeof vi.fn> };
    conversation: { findFirst: ReturnType<typeof vi.fn> };
}) {
    db.channel.findUnique.mockImplementation(async ({ where }: any) =>
        accessData.channels.find((c) => c.id === where.id) ?? null);

    db.member.findFirst.mockImplementation(async ({ where }: any) =>
        accessData.members.find((m) => matches(m, where)) ?? null);

    db.conversation.findFirst.mockImplementation(async ({ where, include }: any) => {
        const { id, OR, ...rest } = where;
        if (Object.keys(rest).length) throw new Error(`sahte DB bu where alanlarını desteklemiyor: ${Object.keys(rest)}`);
        const found = accessData.conversations.find((conv) =>
            conv.id === id && (!OR || (OR as MemberFilter[]).some((filter) => conversationMatches(conv, filter))));
        if (!found) return null;
        return {
            ...found,
            ...(include?.memberOne ? { memberOne: memberById(found.memberOneId) } : {}),
            ...(include?.memberTwo ? { memberTwo: memberById(found.memberTwoId) } : {}),
        };
    });
}
