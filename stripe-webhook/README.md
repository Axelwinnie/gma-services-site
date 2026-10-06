# Stripe webhook for Workflow Map orders

This is a small Node service with no npm packages. When Stripe says a Workflow Map was paid ($249, which is 24900 cents), it emails Jon at granitemodels@gmail.com. It does not email the customer, and it does not send any automatic reply.

A paid Stripe event that is not a Workflow Map still sends one email, with the subject starting `Other Stripe payment`. A Workflow Map email subject looks like `NEW MAP ORDER: Pat Rivera $249`.

The service keeps recent event ids in memory so a Stripe retry does not send a second email. A checkout session and the matching payment are treated as one order. Memory is wiped when the process restarts. That is fine: Render's free plan sleeps after about 15 minutes of idle time, and Stripe retries a webhook that does not get a quick response, including after a cold start.

## Create the Render web service

The repo already lists this service in `render.yaml` as `gma-stripe-webhook`. Syncing that blueprint can create it. If you would rather click through the dashboard, do this:

1. In the Render dashboard, click **New** → **Web Service**. Do not create another static site, and do not change `gma-services`.
2. Connect this same GitHub repo. Branch: `main`.
3. Root Directory: `stripe-webhook`.
4. Runtime: Node.
5. Build command: `echo no-build`.
6. Start command: `node server.js`.
7. Instance type: **Free**.
8. Health check path: `/health`.

Free services spin down after about 15 minutes without traffic. The first request after that can take a little while. Stripe retries, so a cold start is fine.

## Environment variables

Set these on the Render service. Do not put them in git.

| Name | What to put |
| --- | --- |
| `STRIPE_WEBHOOK_SECRET` | The signing secret Stripe shows after you add the endpoint (`whsec_...`). |
| `SMTP_USER` | The Gmail address that sends the mail, such as `granitemodels@gmail.com`. |
| `SMTP_PASS` | A Gmail app password for that account (Google Account → Security → 2-Step Verification → App passwords). This is not the normal Gmail password. |
| `NOTIFY_TO` | Optional. Defaults to `granitemodels@gmail.com`. |
| `FORWARD_WEBHOOK_URL` | Optional. If set, the service also POSTs the same JSON summary there. If that post fails, the Stripe webhook still succeeds. |
| `DRY_RUN` | Leave unset on Render. Set to `1` only for a local test; it prints the email instead of sending it. |

Mail goes out with Gmail SMTP over TLS (`smtp.gmail.com` port 465). The only recipient is `NOTIFY_TO`.

## Stripe endpoint

1. Open the Stripe Dashboard → Developers → Webhooks → Add endpoint.
2. Endpoint URL: `https://<the-onrender-url>/stripe/webhook`
   Example shape: `https://gma-stripe-webhook.onrender.com/stripe/webhook`
3. Events to send: `checkout.session.completed` and `payment_intent.succeeded`.
4. Copy the signing secret into the Render env var `STRIPE_WEBHOOK_SECRET`.
5. Save, then use **Send test event** on that endpoint and pick `checkout.session.completed`.

A test event from the Dashboard is not a real $249 payment, so the email subject will say `Other Stripe payment` unless the test payload is 24900 cents or mentions Workflow Map. That still proves the signature, the endpoint, and the mail path. For a real order, the subject is `NEW MAP ORDER: <customer name or email> $249`.

The email body includes the customer name, email, phone when Stripe has one, the amount, the Stripe session or payment id, and any custom fields, metadata, or notes. The Map email ends with: `Draft the Map setup + reply for Jon to approve. Do not reply to the customer automatically.`

## Local test

From this folder, with Node 20 or newer:

```bash
node test.mjs
```

The script starts the server with `DRY_RUN=1`, signs a sample `checkout.session.completed` payload, and checks a bad signature returns 400. It also talks to a local fake SMTP server (so no real mail goes out) and checks a mail failure still returns 200 to Stripe.
