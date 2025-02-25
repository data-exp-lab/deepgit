import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

console.log(`Building DeepGit with BASE_PATH="${process.env.BASE_PATH || "/deepgit"}"`);

export default defineConfig({
  preview: {
    allowedHosts: ["deepgit-1.onrender.com"],
  },
  base: process.env.BASE_PATH || "/deepgit",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    strictPort: true,
    allowedHosts: ["deepgit-1.onrender.com"]
  },
});
