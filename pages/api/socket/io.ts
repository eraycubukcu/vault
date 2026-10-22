import {Server as NetServer} from "http";
import { NextApiRequest } from "next";

import { NextApiResponseServerIo } from "@/types";
import { createSocketServer } from "@/lib/socket/server";

export const config={
    api:{
        bodyParser:false,
    },
};

const ioHandler=(req:NextApiRequest,res:NextApiResponseServerIo)=>{
    if(!res.socket.server.io){
        const httpServer:NetServer=res.socket.server as any;
        res.socket.server.io=createSocketServer(httpServer);
    }
    res.end()
}

export default ioHandler
