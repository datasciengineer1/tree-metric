import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',                // <-- add this line
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./styles/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: []
};
export default config;

