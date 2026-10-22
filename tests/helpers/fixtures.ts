const createdAt = new Date("2026-01-01T00:00:00Z");

export const VIEWER_EMAIL = "viewer@example.com";
export const OTHER_EMAIL = "other@example.com";
export const OTHER_USER_ID = "user_other";

export const viewerProfile = {
    id: "p-viewer",
    userID: "user_viewer",
    name: "Viewer",
    imageUrl: "https://utfs.io/viewer.png",
    email: VIEWER_EMAIL,
    createdAt,
    updatedAt: createdAt,
};

export const otherProfile = {
    id: "p-other",
    userID: OTHER_USER_ID,
    name: "Other",
    imageUrl: "https://utfs.io/other.png",
    email: OTHER_EMAIL,
    createdAt,
    updatedAt: createdAt,
};

export const viewerMember = {
    id: "m-viewer",
    role: "ADMIN" as const,
    profileId: viewerProfile.id,
    serverId: "s-1",
    createdAt,
    updatedAt: createdAt,
    profile: viewerProfile,
};

export const otherMember = {
    id: "m-other",
    role: "GUEST" as const,
    profileId: otherProfile.id,
    serverId: "s-1",
    createdAt,
    updatedAt: createdAt,
    profile: otherProfile,
};

export const server = {
    id: "s-1",
    name: "Sunucu",
    imageUrl: "https://utfs.io/server.png",
    inviteCode: "invite",
    profileId: viewerProfile.id,
    createdAt,
    updatedAt: createdAt,
    channels: [
        { id: "c-1", name: "general", type: "TEXT" as const, profileId: viewerProfile.id, serverId: "s-1", createdAt, updatedAt: createdAt },
    ],
    members: [viewerMember, otherMember],
};

export const channel = server.channels[0];

export const conversation = {
    id: "conv-1",
    memberOneId: viewerMember.id,
    memberTwoId: otherMember.id,
    memberOne: viewerMember,
    memberTwo: otherMember,
};

export const messageBy = (member: typeof viewerMember | typeof otherMember) => ({
    id: `msg-${member.id}`,
    content: "merhaba",
    fileUrl: null,
    memberId: member.id,
    channelId: channel.id,
    conversationId: conversation.id,
    deleted: false,
    createdAt,
    updatedAt: createdAt,
    member,
});
