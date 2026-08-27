import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#06060c",
};

export const metadata: Metadata = {
  title: "ARKANOID // Retro Cyber Arcade",
  description:
    "High-performance retro arcade Arkanoid brick breaker web app built with Next.js, HTML5 Canvas 60 FPS physics, dynamic power-ups, retro synth audio, and neon aesthetics.",
  keywords: ["arkanoid", "brick breaker", "retro arcade", "canvas game", "nextjs", "react"],
  authors: [{ name: "Arkanoid Cyber Team" }],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-arcade-bg text-arcade-text antialiased min-h-screen flex flex-col justify-center items-center overflow-x-hidden selection:bg-neon-pink selection:text-white">
        {children}
      </body>
    </html>
  );
}
