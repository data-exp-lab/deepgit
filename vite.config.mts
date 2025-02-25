import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// Log the base path for debugging
console.log(`Building DeepGit with BASE_PATH="${process.env.BASE_PATH || "/deepgit"}"`);

export default defineConfig({
  preview: {
    allowedHosts: ['deepgit-1.onrender.com'],
  },
  base: process.env.BASE_PATH || "/deepgit",
  plugins: [react()],
  server: {
    host: "0.0.0.0", // Allows external access (required for Render)
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173, // Use Render's assigned port or fallback to 5173
    strictPort: true, // Prevents Vite from using a different port if the default is unavailable
  },
});
