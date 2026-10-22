import { db } from "@/lib/db";
import { Channel, Conversation, Member } from "@prisma/client";

// Kanalın sunucusunda bu profile ait bir üyelik varsa kanalı ve o üyeliği döner.
export async function getChannelAccess(profileId: string, channelId: string): Promise<{ channel: Channel; member: Member } | null> {
    const channel = await db.channel.findUnique({
        where: { id: channelId },
    });
    if (!channel) {
        return null;
    }

    const member = await db.member.findFirst({
        where: { serverId: channel.serverId, profileId },
    });
    if (!member) {
        return null;
    }

    return { channel, member };
}

// Profil sohbetin iki tarafından biriyse sohbeti ve profilin kendi üyeliğini döner.
export async function getConversationAccess(profileId: string, conversationId: string): Promise<{ conversation: Conversation; member: Member } | null> {
    const found = await db.conversation.findFirst({
        where: {
            id: conversationId,
            OR: [
                { memberOne: { profileId } },
                { memberTwo: { profileId } },
            ],
        },
        include: { memberOne: true, memberTwo: true },
    });
    if (!found) {
        return null;
    }

    const { memberOne, memberTwo, ...conversation } = found;
    const member = [memberOne, memberTwo].find((side) => side.profileId === profileId);
    if (!member) {
        return null;
    }

    return { conversation, member };
}

// `chatId` bir kanal ya da sohbet olabilir; türü bilinmediği için iki sorgu paralel çalışır.
export async function canAccessChat(profileId: string, chatId: string): Promise<boolean> {
    const [channelAccess, conversationAccess] = await Promise.all([
        getChannelAccess(profileId, chatId),
        getConversationAccess(profileId, chatId),
    ]);
    return channelAccess !== null || conversationAccess !== null;
}

// Üyelik bittiğinde socket'i çıkarılacak sohbetler: sunucunun tüm kanalları ve
// bu üyeliğin taraf olduğu özel sohbetler. Silme cascade ile bunları sildiği için silmeden ÖNCE çağrılmalı.
export async function getMemberChatIds(member: { id: string; serverId: string }): Promise<string[]> {
    const [channels, conversations] = await Promise.all([
        db.channel.findMany({ where: { serverId: member.serverId }, select: { id: true } }),
        db.conversation.findMany({
            where: { OR: [{ memberOneId: member.id }, { memberTwoId: member.id }] },
            select: { id: true },
        }),
    ]);
    return [...channels, ...conversations].map(({ id }) => id);
}
