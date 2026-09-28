# Deploy Granite Models Automations on granitemodels.store

`"LAUNCH": true` is set in `site.config.json`. Canonical URLs, Open Graph URLs, `sitemap.xml`, `robots.txt`, and JSON-LD use `https://granitemodels.store`.

Publish the prebuilt `public/` directory from the root of branch `site-launch`. Do not run `node scripts/build.mjs`. That script needs source images and ffmpeg, which are not in this repo. The prebuilt `public/` is the site.

Point the domain at a static site that publishes branch `site-launch`, not at the previous Flask app.

## Render

1. Sign in at [dashboard.render.com](https://dashboard.render.com).
2. Open the service for `granitemodels.store`, or create a new **Static Site** if the current service cannot switch from the Flask app to static files.
3. Set the branch to `site-launch`.
4. Leave **Root Directory** blank.
5. Set **Build Command** to `echo prebuilt`.
6. Set **Publish Directory** to `public`.
7. Leave the environment empty.
8. Add every row in `render-redirects.md` under Redirects/Rewrites (Action: Redirect, status 301).
9. Keep the custom domain `granitemodels.store` on this service.
10. Deploy and open `https://granitemodels.store/`. The home page should show **Granite Models Automations**, the navy header, and a steel estimating card.

`public/_redirects` repeats those rules, and `public/` also contains a meta-refresh file for each old path so the move works before the dashboard rules are saved.

## After deploy

1. Open `https://granitemodels.store/steel-estimating/` and confirm the $149 and $399 Buy buttons.
2. Open `https://granitemodels.store/estimate` and confirm it lands on steel estimating.
3. Open `https://granitemodels.store/contact/` and confirm the mailto is `granitemodels@gmail.com`.
4. Open `https://granitemodels.store/no-such-page` and confirm the “Page not found” page.
