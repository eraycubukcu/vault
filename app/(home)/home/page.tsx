"use client"
import { redirect } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ModeToggle } from "@/components/mode-toggle";
import { HelpSection } from "@/components/home/help-section";

const HomePage = () => {

    const onClick = () => {
        redirect("/");
    }
    const nextSection = () => {
        const section = document.getElementById("1");
        if (section) {
            section.scrollIntoView({ behavior: "smooth" });
        }
    }

    return (
        <>
            <div className="scrollarea overflow-y-scroll h-dvh scroll-smooth snap-y snap-mandatory  scroll-pt-[64px] md:scroll-pt-[104px] transition-all ease-in-out duration-100 ">
                <div className="sticky top-0 bg-[#E3E5E8] dark:bg-[#1E1F22] flex flex-row justify-start items-center max-h-[104px]">
                    <div className="w-full p-2 md:mx-8 md:my-4 md:p-4 rounded-lg bg-[#E3E5E8] dark:bg-[#1E1F22] flex flex-row justify-start items-center">
                        <div className="h-[40px] w-[40px]">
                            <picture>
                                <img src="/darkIcon.png" />
                            </picture>
                        </div>
                        <div className="text-black dark:text-white pl-1 md:pl-5 text-xl antialiased font-bold">Vault</div>
                        <div className="flex-1 flex justify-end items-center">
                            <ModeToggle />
                            <SignedOut>
                                <SignUpButton>
                                    <button type="button" className="flex px-2 py-1 text-sm md:text-normal md:mx-3 md:px-4 md:py-2 rounded-lg hover:rounded-sm transition-all overflow-hidden items-center justify-center bg-transparent dark:bg-transparent hover:bg-[#4B5EFF] hover:text-white dark:hover:bg-[#4B5EFF]">
                                        Kayıt Ol
                                    </button>
                                </SignUpButton>
                                <SignInButton>
                                    <button type="button" className="flex px-2 py-1 mx-1 text-sm md:text-normal md:mx-3 md:px-4 md:py-2 rounded-lg hover:rounded-sm transition-all overflow-hidden items-center justify-center bg-background dark:bg-neutral-700 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500">
                                        Giriş Yap
                                    </button>
                                </SignInButton>
                            </SignedOut >
                            <SignedIn>
                                <button type="button" className="flex px-2 py-1 mx-1 text-sm md:text-normal md:mx-3 md:px-4 md:py-2 rounded-lg hover:rounded-sm transition-all overflow-hidden items-center justify-center bg-background dark:bg-neutral-700 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500" onClick={onClick}>Uygulamaya Devam Et</button>
                                <UserButton afterSwitchSessionUrl="/" appearance={{
                                    elements: {
                                        avatarBox: "h-[40px] w-[40px]"
                                    }
                                }} />
                            </SignedIn>
                        </div>
                    </div>
                </div>
                <div className="snap-start bg-gradient-to-b from-[#E3E5E8] to-white dark:from-[#1E1F22] dark:to-[#313338] h-[calc(100dvh-56px)] md:h-[calc(100dvh-104px)] w-full flex flex-col justify-evenly md:justify-between items-center">
                    <div className="w-full flex">
                        <div className="w-full flex flex-col justify-center items-center mt-6">
                            <div className="text-gray-600 dark:text-white text-2xl md:text-6xl font-bold mb-4 ">Vault'a Hoşgeldiniz</div>
                            <div className="text-gray-500 dark:text-gray-300 px-2 md:px-0">Arkadaşlarınız ve topluluklarınızla kesintisiz bir iletişim deneyimi yaşayın.</div>
                        </div>
                    </div>
                    <div className="w-full flex mt-8">
                        <div className="w-full flex justify-center items-center">
                            <div className="aspect-video transition-all hover:cursor-pointer hover:scale-[105%] bg-gray-500 w-full mx-2 md:mx-0 md:w-1/2 rounded-xl overflow-hidden border-[1px] border-gray-800 dark:border-gray-700">
                                <picture>
                                    <img src="darkMode1.png" className="w-full h-full" />
                                </picture>
                            </div>
                        </div>
                    </div>
                    <div className="w-full flex justify-center items-center mt-8 p-5">
                        <button type="button" className="bg-[#1E1F22] text-white dark:bg-white p-4 dark:text-black rounded-2xl hover:rounded-md transition-all hover:scale-[105%]" onClick={nextSection}>Daha fazla Bilgi</button>
                    </div>
                </div>
                <HelpSection image="cc0.png" side="right"  sectionID={"1"} sectionType="createServer" title="Sunucu Oluştur" description="Kendi alanınızı yaratmak için bir sunucu oluşturun. Sunucu ismi belirleyin, topluluğunuzu yansıtan bir resim ekleyin."/>
                <HelpSection image="if0.png" side="left"   sectionID={"2"} sectionType="inviteFriends" title="Arkadaşlarını Davet Et" description="Sunucunuza katılmaları için arkadaşlarına davet bağlantısı gönderin. Bağlantıyı paylaş ve topluluğunu büyüt."/>
                <HelpSection image="vcj0.png" side="right"  sectionID={"3"} sectionType="joinVC" title="Sesli Sohbete Katıl" description="Topluluğunuzla birlikte sesli ve görüntülü sohbetler için oluşturulan sohbet kanallarına girin."/>
                <HelpSection image="da0.png" side="left"   sectionID={"4"} sectionType="downloadApp" title="Uygulama Olarak İndir" description="Sunucuna ulaşımını kolaylaştırmak için uygulamayı indir"/>
                <HelpSection image="darkMode1.png" side="center" sectionID={"5"} sectionType="finalSection" title="Vault'a kayıt ol" description="Birkaç kolay adımda hesabınızı oluşturun ve sohbet etmeye başlayın."/>
            </div>
        </>
    );
}

export default HomePage;