import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db";
import { NextResponse } from "next/server"
import { getMemberChatIds } from "@/lib/auth/access";
import { leaveServerRooms } from "@/lib/socket/server";

export async function PATCH(
    req:Request,
    {params}:{params:Promise<{serverId:string}>}
){
    try
    {
        const profile=await currentProfile();
        const {serverId}=await params
        if(!profile){
            return new NextResponse("Unauthorized",{status:401})
        }
        if(!serverId){
            return new NextResponse("Server ID missing",{status:400})
        }
        // Socket'leri odalardan çıkarmak için gereken bilgiyi silmeden önce oku.
        const member=await db.member.findFirst({
            where:{serverId,profileId:profile.id}
        })
        const chatIds=member?await getMemberChatIds(member):[]
        const server=await db.server.update({
            where:{
                id:serverId,
                profileId:{
                    not:profile.id
                },
                members:{
                    some:{
                        profileId:profile.id
                    }
                }
            },
            data:{
                members:{
                    deleteMany:{
                        profileId:profile.id
                    }
                }
            }
        })
        leaveServerRooms(profile.id,chatIds)
        return NextResponse.json(server)
    }
    catch(error){
        console.log("[SERVER_ID_LEAVE]",error)
        return new NextResponse("Internal Error",{status:500})
    }
}