"use client";

import dynamic from "next/dynamic";
import React from "react";

// Client-only dynamic import to ensure Canvas and Web Audio APIs initialize cleanly
const GameContainer = dynamic(
  () => import("@/components/GameContainer").then((mod) => mod.GameContainer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-arcade-bg text-neon-cyan font-arcade">
        <div className="text-xl mb-4 animate-pulse text-glow-cyan">
          INITIALIZING CYBER ARKANOID...
        </div>
        <div className="w-48 h-2 bg-arcade-surface border border-arcade-border rounded overflow-hidden">
          <div className="h-full bg-neon-cyan animate-scanline-bar w-1/3" />
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <main className="w-full min-h-screen flex items-center justify-center p-2 sm:p-4 md:p-6">
      <GameContainer />
    </main>
  );
}
