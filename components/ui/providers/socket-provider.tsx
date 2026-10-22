"use client";

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import { useAuth } from "@clerk/nextjs";
import { io as ClientIO } from "socket.io-client";

type SocketContextType = {
    socket: any | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false
});

export const useSocket = () => {
    return useContext(SocketContext);
}

export const SocketProvider = ({children}: { children: React.ReactNode })=>{
    const [socket,setSocket]=useState(null);
    const [isConnected,setIsConnected]=useState(false)
    // useAuth() sunucuda <ClerkProvider dynamic> olmadan hata fırlatır; socket zaten yalnızca
    // istemcide açıldığından bağlantıyı yöneten bileşen mount sonrasında render edilir.
    const [isMounted,setIsMounted]=useState(false)

    useEffect(()=>{
        setIsMounted(true)
    },[])

    return(
        <SocketContext.Provider value={{socket,isConnected}}>
            {isMounted&&<SocketConnection setSocket={setSocket} setIsConnected={setIsConnected}/>}
            {children}
        </SocketContext.Provider>
    )
}

const SocketConnection = ({setSocket,setIsConnected}:{
    setSocket:(socket:any)=>void;
    setIsConnected:(isConnected:boolean)=>void;
})=>{
    const {isSignedIn,getToken}=useAuth()
    // getToken referansı değişse bile bağlantı yeniden kurulmasın diye ref'te tutulur.
    const getTokenRef=useRef(getToken)
    getTokenRef.current=getToken

    useEffect(()=>{
        // Sunucu token'sız bağlantıyı reddeder; oturum yoksa bağlanmaya çalışma.
        if(!isSignedIn){
            return;
        }
        const socketInstance=new (ClientIO as any)(process.env.NEXT_PUBLIC_SITE_URL!,{
            path:"/api/socket/io",
            addTrailingSlash:false,
            // Her (yeniden) bağlanmada taze Clerk token'ı alınır.
            auth:(cb:(data:{token:string|null})=>void)=>{
                getTokenRef.current().then((token)=>cb({token}),()=>cb({token:null}))
            },
        })

        socketInstance.on("connect",()=>{
            setIsConnected(true)
        })
        socketInstance.on("disconnect",()=>{
            setIsConnected(false)
        })
        // Sunucu bağlantıyı reddederse (ör. token süresi dolmuş) socket.io kendiliğinden
        // yeniden denemez; kısa bir bekleme sonrası taze token ile tekrar dene.
        let retry:ReturnType<typeof setTimeout>|undefined
        socketInstance.on("connect_error",()=>{
            if(!socketInstance.active){
                retry=setTimeout(()=>socketInstance.connect(),5000)
            }
        })

        setSocket(socketInstance)
        return ()=>{
            clearTimeout(retry)
            socketInstance.disconnect()
            setSocket(null)
            setIsConnected(false)
        }
    },[isSignedIn,setSocket,setIsConnected])

    return null
}