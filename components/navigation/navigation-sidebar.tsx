import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { redirect } from "next/navigation"
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import { NavigationItem } from "./navigation-item";
import { NavigationAction } from "./navigation-action";
import { ModeToggle } from "@/components/mode-toggle";
import { PushToggle } from "@/components/push-toggle";
import { UserButton } from "@clerk/nextjs";

import * as motion from "motion/react-client"

export const NavigationSideBar = async () => {
    const profile = await currentProfile()
    if (!profile) {
        return redirect("/home");
    }

    const servers = await db.server.findMany({
        where: {
            members: {
                some: {
                    profileId: profile.id
                }
            }
        }
    })


    return (
        <motion.div initial={{ scale:0.90,filter:"blur(4px)",x:-100}} animate={{x:0,filter:["blur(4px)","blur(4px)","blur(4px)","blur(3px)","blur(2px)","blur(0px)"],scale:[0.9,0.9,0.92,0.95,1]}} transition={{bounce:0,duration:.4,ease:[0.68, 0.29, 0, 1.01],times: [0, 0.2, 0.5, 0.8, 1]}}  className="space-y-4 flex flex-col items-center h-full text-primary w-full bg-[#E3E5E8]  dark:bg-[#1E1F22] py-3 rounded-md">
            <NavigationAction />
            <Separator className="h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-md w-10 mx-auto" />
            <ScrollArea className="flex-1 w-full">
                {servers.map((server) => (
                    <div key={server.id} className="mb-4">
                        <NavigationItem id={server.id} name={server.name} imageUrl={server.imageUrl} />
                    </div>
                ))}
            </ScrollArea>
            <div className="pb-3 mt-auto flex items-center flex-col gap-y-4">
                <PushToggle />
                <ModeToggle />
                <UserButton afterSwitchSessionUrl="/" appearance={{
                    elements:{
                        avatarBox:"h-[48px] w-[48px]"
                    }
                }}/>
            </div>
        </motion.div>
    );
}

