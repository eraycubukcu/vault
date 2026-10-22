import {auth} from "@clerk/nextjs/server"
import {db} from "@/lib/db"

// Salt okunur: profil yoksa null döner; hiçbir koşulda yazmaz veya yönlendirmez.
export const currentProfile = async ()=>{
    const {userId}=await auth()
    if(!userId){
        return null;
    }

    const profile=await db.profile.findUnique({
        where:{
            userID:userId
        }
    })
    return profile ?? null;
}
