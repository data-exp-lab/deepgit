import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from 'path';
import fs from 'fs-extra';

// Custom plugin to copy specific files from public
const copySpecificFiles = () => ({
  name: 'copy-specific-files',
  closeBundle: async () => {
    const filesToCopy = [
      'manifest.json',
      'robots.txt',
      'logo.svg',
      'deepgit_logo.png',
      'dxl_logo.png',
      'ossci_logo.jpg',
      'favicon.ico'
    ];

    for (const file of filesToCopy) {
      const sourcePath = resolve(__dirname, 'public', file);
      const targetPath = resolve(__dirname, 'dist', file);
      if (fs.existsSync(sourcePath)) {
        await fs.copy(sourcePath, targetPath);
      }
    }
  }
});

console.log(`Building DeepGit with BASE_PATH="${process.env.BASE_PATH || "/"}"`);

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [
    react(),
    copySpecificFiles()
  ],
  server: {
    host: "0.0.0.0",
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    strictPort: true,
    allowedHosts: ["deepgit.onrender.com"]
  },
  preview: {
    host: "0.0.0.0",
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    allowedHosts: ["deepgit.onrender.com"]
  },
  // Disable automatic public directory copying
  publicDir: false,
  // Manually copy only specific files from public
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
    // Copy only specific files from public
    copyPublicDir: true,
    assetsInlineLimit: 0,
  },
});

