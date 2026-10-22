import { Member, Profile } from "@prisma/client";

// Başka kullanıcılara gönderilebilecek profil alanları. `email` ve `userID` asla yok.
export const publicProfileSelect = { id: true, name: true, imageUrl: true } as const;

export type PublicProfile = Pick<Profile, "id" | "name" | "imageUrl">;

export const messageInclude = { member: { include: { profile: { select: publicProfileSelect } } } } as const;

export const membersWithPublicProfile = { include: { profile: { select: publicProfileSelect } } } as const;

// Üye listesinde yalnızca görüntüleyen kişinin kendi satırına kendi e-postasını ekler.
export const withViewerEmail = <S extends { members: (Member & { profile: PublicProfile })[] }>(server: S, viewer: Profile) => ({
    ...server,
    members: server.members.map((member) =>
        member.profileId === viewer.id ? { ...member, profile: { ...member.profile, email: viewer.email } } : member
    ),
});
