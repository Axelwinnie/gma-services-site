# gma-tiktok-server

Small Node web service (no npm dependencies) behind https://granitemodels.store/tiktok.
The Render static site `gma-services-site` rewrites `/tiktok` and `/tiktok/*` to this service,
so the TikTok redirect URI stays `https://granitemodels.store/tiktok/callback`.

Render web service settings: Root Directory `tiktok-server`, Build `echo no-build`, Start `node server.js`,
Health check path `/tiktok/healthz`, plan Free.

Environment variables (set in the Render dashboard only, never commit them):
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` (required)
- `TIKTOK_REDIRECT_URI` (optional, default `https://granitemodels.store/tiktok/callback`)

Sessions are kept in memory (httpOnly cookie holds a random session id only). No database.
Tokens are never logged. A restart or free-plan spin-down just means logging in again.
