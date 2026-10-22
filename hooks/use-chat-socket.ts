import { useSocket } from "@/components/ui/providers/socket-provider";
import { Member, Message } from "@prisma/client";
import { PublicProfile } from "@/lib/public-profile";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

type ChatSocketProps = {
    chatId: string;
    addKey: string;
    updateKey: string;
    queryKey: string;
}

type MessageWithMemberWithProfile = Message & {
    member: Member & {
        profile: PublicProfile;
    }
}

export const useChatSocket = ({
    chatId,
    addKey,
    updateKey,
    queryKey,
}: ChatSocketProps) => {
    const { socket } = useSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!socket) {
            return;
        }
        // Sunucu yetkiyi kontrol edip odaya katar; yeniden bağlanınca oda üyeliği
        // sıfırlandığı için "connect" olayında tekrar katılınır.
        const join = () => socket.emit("chat:join", chatId, () => {});
        join();
        socket.on("connect", join);

        const onUpdate = (message: MessageWithMemberWithProfile) => {
            queryClient.setQueryData([queryKey], (oldData: any) => {
                if (!oldData || !oldData.pages || oldData.pages.length === 0) {
                    return oldData;
                }
                const newData = oldData.pages.map((page: any) => {
                    return {
                        ...page,
                        items: page.items.map((item: MessageWithMemberWithProfile) => {
                            if (item.id === message.id) {
                                return message;
                            }
                            return item;
                        })
                    }
                })
                return {
                    ...oldData,
                    pages: newData,
                }
            })
        };

        const onAdd = (message: MessageWithMemberWithProfile) => {
            queryClient.setQueryData([queryKey], (oldData: any) => {
                if (!oldData || !oldData.pages || oldData.pages.length === 0) {
                    return {
                        pages: [{
                            items: [message],

                        }]
                    }
                }

                const newData = [...oldData.pages];

                newData[0] = {
                    ...newData[0],
                    items: [
                        message,
                        ...newData[0].items,
                    ]
                }

                return {
                    ...oldData,
                    pages: newData,
                }
            })
        };

        socket.on(updateKey, onUpdate);
        socket.on(addKey, onAdd);

        return ()=>{
            socket.off("connect", join);
            socket.off(addKey, onAdd);
            socket.off(updateKey, onUpdate);
            socket.emit("chat:leave", chatId);
        }

    }, [queryClient,chatId,addKey,queryKey,socket,updateKey])

}