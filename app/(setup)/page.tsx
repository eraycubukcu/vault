import { currentUser } from "@clerk/nextjs/server"
import { getOrCreateProfile } from "@/lib/get-or-create-profile";
import { db } from "@/lib/db"
import { read } from "fs";
import { redirect } from "next/navigation";
import { InitialModal } from "@/components/modals/initial-modal";

const SetupPage = async () => {
    const profile = await getOrCreateProfile()
    const server = await db.server.findFirst({
        where: {
            members: {
                some: {
                    profileId: profile.id
                }
            }
        }
    })
    if (server) {
        return redirect(`/servers/${server.id}`)
    }

    return (
        <>
            <InitialModal />
        </>
    );
}

export default SetupPage;