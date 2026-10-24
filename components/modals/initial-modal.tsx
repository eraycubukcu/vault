"use client";




import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from "@/components/ui/dialog"
import {Form,FormControl,FormField,FormItem,FormLabel,FormMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";

import { useEffect ,useState} from "react";
import { useForm } from "react-hook-form";

import * as z from "zod"
import {zodResolver} from "@hookform/resolvers/zod"
import { FileUpload } from "@/components/file-upload";
import axios from "axios"
import { useRouter } from "next/navigation";

import { useModal } from "@/hooks/use-model.store";

const formSchema=z.object({
    name:z.string().min(1,{message:"Sunucu ismi zorunlu"}),
    imageUrl:z.string().min(1,{message:"Sunucu resmi zorunlu"})
})


export const InitialModal = () => {
    
    const {isOpen,onClose,type}=useModal()
    const [isMounted,setIsMounted]=useState(false)
    const router =useRouter();

    useEffect(()=>{
        setIsMounted(true)
    },[])

    const form=useForm({
        resolver:zodResolver(formSchema),
        defaultValues:{
            name:"",
            imageUrl:""
        }
    })
    const isLoading=form.formState.isSubmitting;
    
    const onSubmit=async(values:z.infer<typeof formSchema>)=>{
        try{
            await axios.post("/api/servers",values);

            form.reset()
            router.refresh()
            window.location.reload()
        }
        catch(error){
            console.log(error)
        }
    }

    if(!isMounted){
        return null
    }
    const handleClose=()=>{
        form.reset()
        onClose()
    }

    return (
        <Dialog open onOpenChange={handleClose}>
            <DialogContent className="bg-white dark:bg-[#1E1F22] dark:text-white text-black p-0 overflow-hidden">
                <DialogHeader className="pt-8 px-6" >
                    <DialogTitle className="text-2xl text-center font-bold">
                        Sunucunuzu özelleştirin
                    </DialogTitle>
                    <DialogDescription className="text-center text-zinc-500 dark:text-white/80">
                        Sunucunuza isim ve resim ekleyin. Sonradan da değişiklik yapabilirsiniz
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <div className="space-y-8 px-6">
                            <div className="flex items-center justify-center text-center">
                                <FormField control={form.control} name="imageUrl" render={({field})=>(
                                    <FormItem>
                                        <FormControl >
                                            <FileUpload endPoint="serverImage" value={field.value} onChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="name" render={({field})=>(
                                <FormItem>
                                    <FormLabel className="uppercase text-xs font-bold text-zinc-500 dark:text-white/80">Sunucu ismi</FormLabel>
                                    <FormControl>
                                        <Input disabled={isLoading} className="bg-zinc-300/50 dark:bg-[#2B2D31] dark:text-white/60 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0" placeholder="Sunucu ismi giriniz" {...field}/>
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}/>
                        </div>
                        <DialogFooter className="bg-gray-100 dark:bg-[#2B2D31] px-6 py-4">
                            <Button type="submit" variant={"primary"} disabled={isLoading}>Oluştur</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}