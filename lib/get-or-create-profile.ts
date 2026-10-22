import {currentUser} from "@clerk/nextjs/server"
import {db} from "@/lib/db";
import { redirect } from "next/navigation";

// Profil oluşturan tek giriş noktası; yalnızca sayfalardan (setup, davet) çağrılır.
// API route'ları salt okunur `currentProfile()` kullanır.
export const getOrCreateProfile = async ()=>{
    const user=await currentUser()
    if(!user){
        return redirect("/home");
    }
    const profile=await db.profile.findUnique({
        where:{
            userID:user.id
        }
    })
    if(profile){
        return profile
    }
    const newProfile= await db.profile.create({
        data:{
            userID:user.id,
            name:`${user.firstName} ${user.lastName}`,
            imageUrl:user.imageUrl,
            email:user.emailAddresses[0].emailAddress
        }
    })
    return newProfile
}
