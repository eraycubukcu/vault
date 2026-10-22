import { verifyToken } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { Socket } from "socket.io";

// Clerk oturum token'ını doğrular ve sahibinin profil id'sini döndürür; token yok, geçersiz
// ya da profil yoksa null. Handshake ve "auth:refresh" aynı doğrulamayı kullanır.
export async function profileIdFromToken(token: unknown): Promise<string | null> {
    if (typeof token !== "string" || !token) {
        return null;
    }

    try {
        const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
        const profile = await db.profile.findUnique({
            where: { userID: payload.sub },
            select: { id: true },
        });
        return profile?.id ?? null;
    } catch {
        return null;
    }
}

// Socket.IO handshake middleware'i: istemcinin `auth.token` alanındaki Clerk
// oturum token'ını doğrular ve profili `socket.data.profileId` alanına yazar.
export async function authenticateSocket(socket: Socket, next: (err?: Error) => void): Promise<void> {
    const profileId = await profileIdFromToken(socket.handshake.auth?.token);
    if (!profileId) {
        return next(new Error("unauthorized"));
    }

    socket.data.profileId = profileId;
    next();
}
