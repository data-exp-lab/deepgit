import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
console.log(`Building Retina with BASE_PATH="${process.env.BASE_PATH || "/retina"}"`);
export default defineConfig({
  base: process.env.BASE_PATH || "/retina",
  plugins: [react()],
});
