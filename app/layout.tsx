import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Orbitron, VT323 } from "next/font/google";
import "./globals.css";

const fontArcade = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-arcade",
  display: "swap",
});

const fontCyber = Orbitron({
  weight: ["400", "600", "700", "900"],
  subsets: ["latin"],
  variable: "--font-cyber",
  display: "swap",
});

const fontPixel = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

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
    <html
      lang="en"
      className={`dark ${fontArcade.variable} ${fontCyber.variable} ${fontPixel.variable}`}
    >
      <body className="bg-arcade-bg text-arcade-text antialiased min-h-screen flex flex-col justify-center items-center overflow-x-hidden selection:bg-neon-pink selection:text-white">
        {children}
      </body>
    </html>
  );
}
