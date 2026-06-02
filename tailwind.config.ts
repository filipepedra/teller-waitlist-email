import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./emails/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
