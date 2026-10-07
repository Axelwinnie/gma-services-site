# Granite Models Automations

Static site for [granitemodels.store](https://granitemodels.store).

This branch is `services-site`. It replaces the previous apex site. Do not deploy `main` for this site, and do not merge this branch into `main`.

`node scripts/build.mjs` reads `site.config.json` and `src/site.css`, then writes `public/`.

## Demo Lab (private)

`demo-lab/` is a separate static site. It is not linked from this store. Do not post it. See `demo-lab/README.md`.

## Render

Use a **Static Site** pointed at this branch.

| Setting | Value |
| --- | --- |
| Repository | `granitemodels-hub/granite-models-store` |
| Branch | `services-site` |
| Root directory | repo root (leave blank) |
| Build command | `node scripts/build.mjs` |
| Publish directory | `public` |

Leave environment variables empty. Old paths are listed in `render-redirects.md` for the Render Redirects/Rewrites screen. The same rules are in `public/_redirects`, and each old path also has a meta-refresh HTML file.

## Check

```bash
node scripts/check.mjs
```

`LAUNCH` is true. `FORM_ENABLED` is false. Steel estimate packets are on `/steel-estimating/`.
