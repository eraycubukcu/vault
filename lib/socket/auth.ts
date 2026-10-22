import { verifyToken } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { Socket } from "socket.io";

// Socket.IO handshake middleware'i: istemcinin `auth.token` alanındaki Clerk
// oturum token'ını doğrular ve profili `socket.data.profileId` alanına yazar.
export async function authenticateSocket(socket: Socket, next: (err?: Error) => void): Promise<void> {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) {
        return next(new Error("unauthorized"));
    }

    try {
        const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
        const profile = await db.profile.findUnique({
            where: { userID: payload.sub },
            select: { id: true },
        });
        if (!profile) {
            return next(new Error("unauthorized"));
        }

        socket.data.profileId = profile.id;
        next();
    } catch {
        next(new Error("unauthorized"));
    }
}
