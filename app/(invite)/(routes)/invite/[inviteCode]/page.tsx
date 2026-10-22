import { getOrCreateProfile } from "@/lib/get-or-create-profile";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

interface InviteCodePageProps {
    params: Promise<{
        inviteCode: string;
    }>;
};

const InviteCodePage = async ({ params }: InviteCodePageProps) => {
    // Davet linkiyle ilk kez gelen kullanıcının henüz profili yok; burada oluşturulur.
    const profile = await getOrCreateProfile()

    const { inviteCode } = await params

    if (!inviteCode) {
        return redirect("/home");
    }

    const existingServer = await db.server.findFirst({
        where: {
            inviteCode: inviteCode,
            members: {
                some: {
                    profileId: profile.id
                }
            }
        }
    })
    if (existingServer) {
        return redirect(`/servers/${existingServer.id}`);
    }

    const server = await db.server.update({
        where: {
            inviteCode: inviteCode,
        },
        data: {
            members: {
                create: {
                    profileId: profile.id
                }
            }
        },
    })
    if (server) {
        return redirect(`/servers/${server.id}`)
    }
    else {
        return null
    }

    return (<></>);
}

export default InviteCodePage;