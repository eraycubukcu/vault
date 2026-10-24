import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Open_Sans } from 'next/font/google'
import { ClerkProvider, SignedIn } from "@clerk/nextjs";

import { cn } from "@/lib/utils";

import { ThemeProvider } from "@/components/ui/providers/theme-provider";
import { ModalProvider } from "@/components/ui/providers/modal-provider";
import { SocketProvider } from "@/components/ui/providers/socket-provider";
import { QueryProvider } from "@/components/ui/providers/query-provider";
import manifest from "./manifest";
import { ThemeColorChanger } from "@/components/theme-color-changer";
import { PushSessionGuard } from "@/components/push-toggle";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const openSansFont = Open_Sans({ subsets: [] })


export const metadata: Metadata = {
  title: "Vault | Chat",
  description: "Vault Chat Application",
};

manifest()

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl={"/home"}>
      <html lang="tr" suppressHydrationWarning>
        <head>
          <link rel="icon" href="/darkIcon.ico" />
        </head>
        <body className={cn(`${openSansFont.className} antialiased`, "bg-white dark:bg-[#313338]")}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="vault-theme">
            <ThemeColorChanger lightThemeColor="#ffffff" darkThemeColor="#313338" />
            <PushSessionGuard />
            <SocketProvider>
              <ModalProvider />
              <QueryProvider>
                {children}
              </QueryProvider>
            </SocketProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
