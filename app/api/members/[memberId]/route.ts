import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db";
import { membersWithPublicProfile, withViewerEmail } from "@/lib/public-profile";
import { NextResponse } from "next/server"
import { getMemberChatIds } from "@/lib/auth/access";
import { leaveServerRooms } from "@/lib/socket/server";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ memberId: string } >}
) {
    try {
        const profile = await currentProfile()
        const {memberId}=await params
        const { searchParams } = new URL(req.url);
        const { role } = await req.json()

        const serverId = searchParams.get("serverId");

        if (!profile) {
            return new NextResponse("Unauthorized", { status: 401 })
        }
        if (!serverId) {
            return new NextResponse("Server ID missing", { status: 400 })
        }
        if (!memberId) {
            return new NextResponse("Member ID missing", { status: 400 })
        }
        const server = await db.server.update({
            where: {
                id: serverId,
                profileId: profile.id
            },
            data: {
                members: {
                    update: {
                        where: {
                            id: memberId,
                            profileId: {
                                not: profile.id
                            }
                        },
                        data: {
                            role
                        }
                    }
                }
            },
            include: {
                members: {
                    ...membersWithPublicProfile,
                    orderBy: {
                        role: "asc"
                    }
                }
            }
        })
        return NextResponse.json(withViewerEmail(server, profile))
    }
    catch (error) {
        console.log("[MEMBERRS_ID_PATCH]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
export async function DELETE(req: Request, { params }: { params: Promise<{ memberId: string }> }) {

    try {
        const profile = await currentProfile()
        const {memberId}=await params

        const { searchParams } = new URL(req.url);
        const serverId = searchParams.get("serverId")

        if (!profile) {
            return new NextResponse("Unauthorized", { status: 401 })
        }
        if (!serverId) {
            return new NextResponse("Server ID missing", { status: 400 })
        }
        if (!memberId) {
            return new NextResponse("Member ID missing", { status: 400 })
        }
        // Atılan kişinin socket'lerini odalardan çıkarmak için gereken bilgiyi silmeden önce oku.
        // Yalnızca sunucu sahibi için okunur; başarısız olacak istek ek sorgu çalıştırmaz (F-27).
        const kicked = await db.member.findFirst({
            where: { id: memberId, serverId, server: { profileId: profile.id } }
        })
        const kickedChatIds = kicked && kicked.profileId !== profile.id ? await getMemberChatIds(kicked) : []
        const server = await db.server.update({
            where: {
                id: serverId,
                profileId: profile.id
            },
            data: {
                members: {
                    deleteMany: {
                        id:memberId,
                        profileId: {
                            not: profile.id
                        }
                    }
                }
            },
            include: {
                members: {
                    ...membersWithPublicProfile,
                    orderBy: {
                        role: "asc",
                    }
                }
            }
        })
        if (kicked && kickedChatIds.length) {
            leaveServerRooms(kicked.profileId, kickedChatIds)
        }
        return NextResponse.json(withViewerEmail(server, profile))
    }
    catch (error) {
        console.log("[MEMBER_ID_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}