import {Server as NetServer,Socket} from "net"
import { NextApiResponse } from "next";
import{Server as SocketIOServer} from "socket.io"
import {Server,Member} from "@prisma/client"
import { PublicProfile } from "@/lib/public-profile"

export type ServerWithMembersWithProfiles=Server&{
    // `email` yalnızca görüntüleyen kişinin kendi satırında bulunur (bkz. withViewerEmail)
    members:(Member& {profile:PublicProfile & {email?:string}})[];
}

export type NextApiResponseServerIo=NextApiResponse &{
    socket:Socket &{
        server: NetServer &{
            io:SocketIOServer;
        }
    }
}