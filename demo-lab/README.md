# GMA Demo Lab

Private preview for Granite Models Automations. Jon owns this.

Do not promote it. Do not post it. Do not add a link from the granitemodels.store home page, nav, or sitemap.

The store site in `public/` is unchanged. This folder is its own static site.

## What is live in the files

- Home: `public/index.html`
- Tool Ticket System: `public/demos/ticket/`
- Doc Extract: `public/demos/extract/`
- File Organizer: `public/demos/organizer/`
- `public/robots.txt` disallows every crawler

Every page sends `noindex, nofollow`. A banner on each page says **Internal preview — not public**.

There is no password gate. A password in the browser is easy to walk around. Anyone who has the URL can open the site. Search engines are told to stay out. Share the URL only with people who should see it.

## What you do by hand

1. In Render, create a **Static Site** named `gma-demo-lab` (or sync the root `render.yaml`, which already lists this service).
   - Repository: this repo
   - Branch: `main`
   - Root directory: `demo-lab`
   - Build command: `echo prebuilt`
   - Publish directory: `public`
   - Auto-deploy: on
2. Leave the granitemodels.store service, `/tiktok`, and the steel pages alone.
3. Attach the custom domain `demo.granitemodels.store` on this new static site.
4. In Cloudflare DNS for `granitemodels.store`, add a CNAME:
   - Name: `demo`
   - Target: the hostname Render shows when you add the custom domain (the `onrender.com` name)
5. If the certificate does not finish, set that Cloudflare record to DNS only until Render issues the cert. Then you can turn the proxy back on with SSL mode Full.
6. Until the CNAME is attached, use the `onrender.com` URL Render gives `gma-demo-lab` to wire the programs.

Expected paths once the domain is on:

- `https://demo.granitemodels.store/`
- `https://demo.granitemodels.store/demos/ticket/`
- `https://demo.granitemodels.store/demos/extract/`
- `https://demo.granitemodels.store/demos/organizer/`

## Wire a real demo

Each stub has a dashed box and this comment:

```html
<!-- WIRE: replace this with live demo embed or SPA -->
```

The box has `data-demo-id` set to `ticket`, `extract`, or `organizer`. Replace the inside of that box with the embed or the app. `public/js/demo-lab.js` collects those nodes on `window.GMADemoLab` if a program wants to find them.

## When you want it public

Do this only when you mean it:

1. Change `public/robots.txt` so crawlers are allowed.
2. Remove `<meta name="robots" content="noindex, nofollow">` from each page.
3. Take down the internal preview banner, or rewrite it.
4. Then, if you want, add a link from granitemodels.store.

Until those edits, this lab stays an internal preview.
