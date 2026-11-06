import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#222D5D",
          50: "#EEF0F7",
          100: "#D9DDEC",
          200: "#B3BAD8",
          300: "#7F89B8",
          400: "#4E5A92",
          500: "#222D5D",
          600: "#1D2650",
          700: "#171F42",
          800: "#111733",
          900: "#0B0F22",
        },
        gold: {
          DEFAULT: "#FFD700",
          50: "#FFFBE0",
          100: "#FFF5B3",
          200: "#FFEB66",
          300: "#FFE133",
          400: "#FFD700",
          500: "#E6C200",
          600: "#B39700",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
