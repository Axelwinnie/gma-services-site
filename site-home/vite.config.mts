import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Source lives in web/. The build writes public/index.html, public/products/index.html and public/site/*,
// next to the hand-written pages of the main site, which it never touches.
export default defineConfig({
  root: "web",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "../../public",
    emptyOutDir: false,
    assetsDir: "site",
    target: "es2020",
    chunkSizeWarningLimit: 900,
    modulePreload: { resolveDependencies: (_f, deps) => deps.filter((d) => !d.includes("three")) },
    rollupOptions: {
      input: { home: at("./web/index.html"), products: at("./web/products/index.html") },
      output: {
        manualChunks: (id) => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? "react" : /node_modules\/(three|@react-three|three-stdlib|troika|maath|zustand|its-fine|suspend-react)/.test(id) ? "three" : undefined),
      },
    },
  },
});
