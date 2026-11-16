import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        app: {
          bg: "#F7F8FA",
          surface: "#FFFFFF",
          text: "#171B26",
          muted: "#697386",
          border: "#E7EAF0",
          hover: "#F1F3F7",
          sidebar: "#F2F4F7",
          accent: "#3659C9",
          accentHover: "#2B47A1",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "#3659C9",
          foreground: "#ffffff",
          50: "#F0F4FE",
          100: "#E2EAFA",
          200: "#C7D6F5",
          300: "#9EB9ED",
          400: "#6E93E3",
          500: "#4971D5",
          600: "#3659C9",
          700: "#2B47A1",
          800: "#243A80",
          900: "#203168",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        brand: ["'Inter'", "sans-serif"],
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
};

export default config;

