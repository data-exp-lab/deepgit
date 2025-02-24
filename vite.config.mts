import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
console.log(`Building DeepGit with BASE_PATH="${process.env.BASE_PATH || "/deepgit"}"`);
export default defineConfig({
  base: process.env.BASE_PATH || "/deepgit",
  plugins: [react()],
});
