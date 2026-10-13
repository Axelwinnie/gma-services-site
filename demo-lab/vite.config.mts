import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Source lives in web/, the build lands in public/ next to the untouched /demos/* pages.
export default defineConfig({
  root: "web",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "../public",
    emptyOutDir: false,
    assetsDir: "lab",
    target: "es2020",
    chunkSizeWarningLimit: 900,
    // three is only fetched when the 3D lab actually mounts (desktop, motion allowed)
    modulePreload: { resolveDependencies: (_f, deps) => deps.filter((d) => !d.includes("three")) },
    rollupOptions: {
      input: {
        home: at("./web/index.html"),
        ticket: at("./web/demos/ticket/index.html"),
        estimating: at("./web/demos/estimating/index.html"),
        organizer: at("./web/demos/organizer/index.html"),
        extract: at("./web/demos/extract/index.html"),
      },
      output: {
        manualChunks: (id) => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? "react" : /node_modules\/(three|@react-three|three-stdlib|troika|maath|zustand|its-fine|suspend-react)/.test(id) ? "three" : undefined),
      },
    },
  },
  server: { fs: { allow: [".."] } },
});
