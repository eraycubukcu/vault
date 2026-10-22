import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db"
import { membersWithPublicProfile, withViewerEmail } from "@/lib/public-profile"
import { ChannelType, MemberRole } from "@prisma/client"
import { redirect } from "next/navigation"
import { ServerHeader } from "./server-header"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ServerSearch } from "./server-search"
import { Hash, Mic, ShieldAlert, ShieldCheck, Video } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { ServerSection } from "./server-section"
import { ServerChannel } from "./server-channel"
import { ServerMember } from "./server-member"

import * as motion from "motion/react-client"

interface ServerSidebarProps {
    serverId: string
}

const iconMap = {
    [ChannelType.TEXT]: <Hash className="mr-2 h-4 w-4" />,
    [ChannelType.AUDIO]: <Mic className="mr-2 h-4 w-4" />,
    [ChannelType.VIDEO]: <Video className="mr-2 h-4 w-4" />
}

const roleIconMap = {
    [MemberRole.GUEST]: null,
    [MemberRole.MODERATOR]: <ShieldCheck className="h-4 w-4 ml-2 text-indigo-500" />,
    [MemberRole.ADMIN]: <ShieldAlert className="h-4 w-4 ml-2 text-rose-500" />
}

export const ServerSidebar = async ({ serverId }: ServerSidebarProps) => {

    const profile = await currentProfile()
    if (!profile) {
        return redirect("/home")
    }

    const serverData = await db.server.findUnique({
        where: {
            id: serverId,
        },
        include: {
            channels: {
                orderBy: {
                    createdAt: "asc",
                }
            },
            members: {
                ...membersWithPublicProfile,
                orderBy: {
                    role: "asc",
                }
            }
        }
    })

    const server = serverData && withViewerEmail(serverData, profile)

    const textChannels = server?.channels.filter((channel) => channel.type === ChannelType.TEXT)
    const audioChannels = server?.channels.filter((channel) => channel.type === ChannelType.AUDIO)
    const videoChannels = server?.channels.filter((channel) => channel.type === ChannelType.VIDEO)

    const members = server?.members.filter((member) => member.profileId !== profile.id)

    if (!server) {
        return redirect("/home")
    }
    const role = server.members.find((member) => member.profileId === profile.id)?.role;

    return (
        <motion.div initial={{filter:"blur(4px)"}} animate={{filter:"blur(0px)"}} transition={{type:"spring",bounce:0,duration:.4}} className="flex flex-col h-full text-primary w-full dark:bg-[#2B2D31] bg-[#F2F3F5] rounded-md">
            <ServerHeader server={server} role={role} />
            <ScrollArea className="flex-1 px-3">
                <div className="mt-2">
                    <ServerSearch data={[
                        {
                            label: "Text Channels",
                            type: "channel",
                            data: textChannels?.map((channel) => ({
                                id: channel.id,
                                name: channel.name,
                                icon: iconMap[channel.type],
                            }))
                        },
                        {
                            label: "Voice Channels",
                            type: "channel",
                            data: audioChannels?.map((channel) => ({
                                id: channel.id,
                                name: channel.name,
                                icon: iconMap[channel.type],
                            }))
                        },
                        {
                            label: "Video Channels",
                            type: "channel",
                            data: videoChannels?.map((channel) => ({
                                id: channel.id,
                                name: channel.name,
                                icon: iconMap[channel.type],
                            }))
                        }
                        ,
                        {
                            label: "Members",
                            type: "member",
                            data: members?.map((member) => ({
                                id: member.id,
                                name: member.profile.name,
                                icon: roleIconMap[member.role],
                            }))
                        }
                    ]} />
                </div>
                <Separator className="bg-zinc-200 dark:bg-zinc-700 rounded-md my-2" />
                {!!textChannels?.length && (
                    <div className="mb-2">
                        <ServerSection sectionType="channels" channelType={ChannelType.TEXT} role={role} label="Text Channels" />
                        <div className="space-y-[2px]">
                            {textChannels.map((channel) => (
                                <ServerChannel key={channel.id} channel={channel} role={role} server={server} />
                            ))}
                        </div>
                    </div>
                )}
                {!!audioChannels?.length && (
                    <div className="mb-2">
                        <ServerSection sectionType="channels" channelType={ChannelType.AUDIO} role={role} label="Voice Channels" />
                        <div className="space-y-[2px]">
                            {audioChannels.map((channel) => (
                                <ServerChannel key={channel.id} channel={channel} role={role} server={server} />
                            ))}
                        </div>
                    </div>
                )}
                {!!videoChannels?.length && (
                    <div className="mb-2">
                        <ServerSection sectionType="channels" channelType={ChannelType.VIDEO} role={role} label="Video Channels" />
                        <div className="space-y-[2px]">
                            {videoChannels.map((channel) => (
                                <ServerChannel key={channel.id} channel={channel} role={role} server={server} />
                            ))}
                        </div>
                    </div>
                )}
                {!!members?.length && (
                    <div className="mb-2">
                        <ServerSection sectionType="members" role={role} label="Kullanıcılar" server={server} />
                        <div className="space-y-[2px]">
                            {members.map((member) => (
                                <ServerMember key={member.id} member={member} server={server} />
                            ))}
                        </div>
                    </div>
                )}
            </ScrollArea>
        </motion.div>
    )
}