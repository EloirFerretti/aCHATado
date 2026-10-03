import type { Metadata } from "next";
import "./globals.css";
import "./chat/redesign.css";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: "aCHATado",
  description: "Chat unificado de Twitch, Kick e YouTube",
  verification: {
    google: "mwoQ9eBLr0x7xwg6LjaMga9Zkrm8xfTQsVVo7ELTMPs",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${jakarta.variable}`}>{children}</body>
    </html>
  );
}
