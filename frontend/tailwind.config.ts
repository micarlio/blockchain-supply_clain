import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#fcf9f8",
        surface: "#fcf9f8",
        "surface-dim": "#dcd9d9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f6f3f2",
        "surface-container": "#f0edec",
        "surface-container-high": "#ebe7e7",
        "surface-container-highest": "#e5e2e1",
        "surface-variant": "#e5e2e1",
        outline: "#727687",
        "outline-variant": "#c2c6d8",
        primary: "#0050cb",
        "primary-container": "#0066ff",
        "primary-fixed": "#dae1ff",
        secondary: "#425ca0",
        "secondary-fixed": "#dae1ff",
        tertiary: "#a33200",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-surface": "#1c1b1b",
        "on-surface-variant": "#424656",
        "on-primary": "#ffffff",
        "on-primary-fixed": "#001849",
        "on-secondary-fixed": "#001849",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        ambient: "0px 12px 32px rgba(28, 27, 27, 0.06)",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg, #0050cb 0%, #0066ff 100%)",
      },
      animation: {
        pulseSoft: "pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".5" },
        },
      },
      borderRadius: {
        xl: "0.75rem",
      },
    },
  },
  plugins: [],
}

export default config
