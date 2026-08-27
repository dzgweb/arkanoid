import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./game/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        arcade: ["var(--font-arcade)", "monospace", "system-ui"],
        cyber: ["var(--font-cyber)", "sans-serif"],
        pixel: ["var(--font-pixel)", "monospace"],
      },
      colors: {
        arcade: {
          bg: "#06060c",
          surface: "#0e0e1a",
          card: "#16162a",
          border: "#26264d",
          muted: "#6b7280",
          text: "#f3f4f6",
        },
        neon: {
          cyan: "#00f0ff",
          pink: "#ff007f",
          purple: "#bf00ff",
          amber: "#ffb700",
          green: "#00ff66",
          blue: "#0080ff",
          red: "#ff1744",
          gold: "#ffd700",
          silver: "#c0c0c0",
        },
      },
      boxShadow: {
        "glow-cyan": "0 0 10px rgba(0, 240, 255, 0.6), 0 0 20px rgba(0, 240, 255, 0.3)",
        "glow-pink": "0 0 10px rgba(255, 0, 127, 0.6), 0 0 20px rgba(255, 0, 127, 0.3)",
        "glow-green": "0 0 10px rgba(0, 255, 102, 0.6), 0 0 20px rgba(0, 255, 102, 0.3)",
        "glow-amber": "0 0 10px rgba(255, 183, 0, 0.6), 0 0 20px rgba(255, 183, 0, 0.3)",
        "glow-purple": "0 0 10px rgba(191, 0, 255, 0.6), 0 0 20px rgba(191, 0, 255, 0.3)",
        "glow-red": "0 0 10px rgba(255, 23, 68, 0.6), 0 0 20px rgba(255, 23, 68, 0.3)",
        "arcade-bezel": "inset 0 0 20px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 240, 255, 0.2)",
      },
      dropShadow: {
        "neon-cyan": "0 0 8px rgba(0, 240, 255, 0.8)",
        "neon-pink": "0 0 8px rgba(255, 0, 127, 0.8)",
        "neon-green": "0 0 8px rgba(0, 255, 102, 0.8)",
        "neon-amber": "0 0 8px rgba(255, 183, 0, 0.8)",
      },
      keyframes: {
        "scanline-move": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1000%)" },
        },
        "crt-flicker": {
          "0%": { opacity: "0.98" },
          "50%": { opacity: "1" },
          "52%": { opacity: "0.96" },
          "54%": { opacity: "1" },
          "100%": { opacity: "0.99" },
        },
        "pulse-glow": {
          "0%, 100%": {
            filter: "drop-shadow(0 0 8px rgba(0, 240, 255, 0.8))",
          },
          "50%": {
            filter: "drop-shadow(0 0 16px rgba(0, 240, 255, 1))",
          },
        },
        "pulse-glow-pink": {
          "0%, 100%": {
            filter: "drop-shadow(0 0 8px rgba(255, 0, 127, 0.8))",
          },
          "50%": {
            filter: "drop-shadow(0 0 16px rgba(255, 0, 127, 1))",
          },
        },
        "float-badge": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "scanline-bar": "scanline-move 8s linear infinite",
        "crt-flicker": "crt-flicker 0.15s infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "pulse-glow-pink": "pulse-glow-pink 2s ease-in-out infinite",
        "float-badge": "float-badge 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
