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
import { AUTH_REFRESH_INTERVAL_MS, SOCKET_INIT_URL, SOCKET_PATH } from "@/lib/socket/path";

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
    const {isSignedIn,userId,sessionId,getToken}=useAuth()
    // getToken referansı değişse bile bağlantı yeniden kurulmasın diye ref'te tutulur.
    const getTokenRef=useRef(getToken)
    getTokenRef.current=getToken

    // Clerk çoklu oturumda hesap değişince isSignedIn true kalır; socket'in eski profilde
    // kalmaması için bağlantı userId/sessionId değişince de yeniden kurulur (F-25).
    useEffect(()=>{
        // Sunucu token'sız bağlantıyı reddeder; oturum yoksa bağlanmaya çalışma.
        if(!isSignedIn){
            return;
        }
        let cancelled=false
        // Socket.IO sunucusu ilk istekte SOCKET_INIT_URL route'unda başlatılır; socket ise
        // route'u olmayan SOCKET_PATH'e bağlanır (bkz. lib/socket/path.ts). Başlatma isteği
        // başarısız olsa da bağlanmayı dener: sunucu zaten ayakta olabilir.
        const initServer=()=>fetch(SOCKET_INIT_URL).catch(()=>{})
        const start=()=>{
            initServer().then(()=>{
                if(!cancelled){
                    socketInstance.connect()
                }
            })
        }
        const socketInstance=new (ClientIO as any)(process.env.NEXT_PUBLIC_SITE_URL!,{
            path:SOCKET_PATH,
            addTrailingSlash:false,
            autoConnect:false,
            // Her (yeniden) bağlanmada taze Clerk token'ı alınır.
            auth:(cb:(data:{token:string|null})=>void)=>{
                getTokenRef.current().then((token)=>cb({token}),()=>cb({token:null}))
            },
        })

        socketInstance.on("connect",()=>{
            setIsConnected(true)
        })
        // Sunucu bağlantıyı reddederse (ör. token süresi dolmuş) ya da kendisi koparırsa (yeniden
        // doğrulama süresi doldu) socket.io kendiliğinden yeniden denemez; kısa bir bekleme sonrası
        // taze token ile tekrar dene.
        let retry:ReturnType<typeof setTimeout>|undefined
        socketInstance.on("disconnect",(reason:string)=>{
            setIsConnected(false)
            if(reason==="io server disconnect"){
                retry=setTimeout(start,5000)
            }
        })
        socketInstance.on("connect_error",()=>{
            if(!socketInstance.active){
                retry=setTimeout(start,5000)
            }
        })
        // Sunucu yeniden başlarsa Socket.IO yeniden kurulana kadar SOCKET_PATH'e gelen istekler
        // Next'e düşer; her otomatik yeniden bağlanma denemesinde sunucuyu başlatmayı tetikle.
        socketInstance.io.on("reconnect_attempt",initServer)

        // F-25: sunucu kimliği düzenli olarak yeniden doğrular; token alınamazsa (oturum
        // kapatılmış) null gönderilir ve sunucu süre dolunca socket'i koparır.
        const refresh=setInterval(()=>{
            if(!socketInstance.connected){
                return;
            }
            const send=(token:string|null)=>{
                if(!cancelled){
                    socketInstance.emit("auth:refresh",token)
                }
            }
            getTokenRef.current().then(send,()=>send(null))
        },AUTH_REFRESH_INTERVAL_MS)

        setSocket(socketInstance)
        start()
        return ()=>{
            cancelled=true
            clearTimeout(retry)
            clearInterval(refresh)
            socketInstance.disconnect()
            setSocket(null)
            setIsConnected(false)
        }
    },[isSignedIn,userId,sessionId,setSocket,setIsConnected])

    return null
}