# granitemodels.store home and products pages

React + TypeScript + Vite + React Three Fiber, same stack as demo-lab.

- Source: `web/` (`index.html` is the landing page, `products/index.html` is /products/).
- Build: `npm run build` (node_modules can be a symlink to ../demo-lab/node_modules). It writes
  `public/index.html`, `public/products/index.html` and `public/site/*`. Clear `public/site` first.
- Art: `tools/bake-landing.py` and `tools/bake-products.py` patch the GPT art and write
  `public/assets/home/*-scene*.svg`. Station boxes are in `web/src/stations.ts` (pixels of the 1672x941 art).
- Program plans and Stripe Payment Links: `web/src/products.tsx`.
- Do not run scripts/build.mjs, it regenerates public/ from src/ and would overwrite these pages.
