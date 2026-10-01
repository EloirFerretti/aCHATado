import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "aCHATado",
  description: "Chat unificado de Twitch, Kick e YouTube",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
