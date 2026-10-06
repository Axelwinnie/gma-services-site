'use strict';
// Granite Models Automations - Stripe webhook for Workflow Map orders.
// No dependencies. Verifies Stripe signatures, then emails Jon only.
// Never emails the customer. Never logs secrets or card data.

const http = require('http');
const crypto = require('crypto');
const tls = require('tls');

const PORT = Number(process.env.PORT || 10000);
const MAP_CENTS = 24900;
const TOLERANCE_SEC = 5 * 60;
const MAX_BODY = 1000 * 1000;
const SEEN_MAX = 2000;
// Gmail on 465. SMTP_HOST, SMTP_PORT, and SMTP_CA are only for the local test.
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_CA = process.env.SMTP_CA || '';

const NOTIFY_TO = (process.env.NOTIFY_TO || 'granitemodels@gmail.com').trim();
const WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || '').trim();
const FORWARD_URL = (process.env.FORWARD_WEBHOOK_URL || '').trim();
const DRY_RUN = /^(1|true)$/i.test((process.env.DRY_RUN || '').trim());

const seen = new Map();

function log(...parts) {
  let line = parts.map((p) => (p instanceof Error ? p.message : String(p))).join(' ');
  if (WEBHOOK_SECRET.length > 3) line = line.split(WEBHOOK_SECRET).join('[redacted]');
  if (SMTP_PASS.length > 3) line = line.split(SMTP_PASS).join('[redacted]');
  console.log(new Date().toISOString(), line);
}

function remember(key) {
  if (!key) return;
  if (seen.has(key)) seen.delete(key);
  seen.set(key, Date.now());
  if (seen.size <= SEEN_MAX) return;
  const drop = seen.size - 1500;
  const iter = seen.keys();
  for (let i = 0; i < drop; i++) {
    const next = iter.next();
    if (next.done) break;
    seen.delete(next.value);
  }
}

function text(res, status, body) {
  const payload = String(body);
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseSignature(header) {
  const out = { timestamp: '', v1: [] };
  for (const part of String(header || '').split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key === 't') out.timestamp = value;
    else if (key === 'v1' && value) out.v1.push(value);
  }
  return out;
}

function verifySignature(raw, header) {
  if (!WEBHOOK_SECRET) return { ok: false, status: 500, message: 'webhook secret is not set' };
  if (!header) return { ok: false, status: 400, message: 'missing signature' };
  const parsed = parseSignature(header);
  if (!/^\d+$/.test(parsed.timestamp) || parsed.v1.length === 0) {
    return { ok: false, status: 400, message: 'invalid signature' };
  }
  const age = Math.floor(Date.now() / 1000) - Number(parsed.timestamp);
  if (age > TOLERANCE_SEC) return { ok: false, status: 400, message: 'timestamp outside tolerance' };
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${parsed.timestamp}.`).update(raw).digest('hex');
  const match = parsed.v1.some((sig) => safeEqual(sig, expected));
  if (!match) return { ok: false, status: 400, message: 'invalid signature' };
  return { ok: true };
}

function containsPhrase(value, phrase) {
  if (value == null) return false;
  if (typeof value === 'string') return value.toLowerCase().includes(phrase);
  if (typeof value === 'number' || typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.some((item) => containsPhrase(item, phrase));
  if (typeof value === 'object') {
    return Object.entries(value).some(([key, item]) => containsPhrase(key, phrase) || containsPhrase(item, phrase));
  }
  return false;
}

function isMapOrder(obj, cents) {
  const currency = String(obj.currency || 'usd').toLowerCase();
  if (cents === MAP_CENTS && currency === 'usd') return true;
  return containsPhrase(
    [obj.description, obj.statement_descriptor, obj.metadata, obj.line_items, obj.display_items],
    'workflow map',
  );
}

function centsOf(obj) {
  const ordered = obj.object === 'payment_intent'
    ? [obj.amount_received, obj.amount]
    : [obj.amount_total, obj.amount_subtotal, obj.amount];
  let fallback = null;
  for (const candidate of ordered) {
    if (candidate == null || candidate === '') continue;
    const n = Number(candidate);
    if (!Number.isFinite(n)) continue;
    const cents = Math.round(n);
    if (cents > 0) return cents;
    if (fallback == null) fallback = cents;
  }
  return fallback;
}

function idOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.id === 'string') return value.id;
  return '';
}

function firstText(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function pickCustomer(obj) {
  const details = obj.customer_details || {};
  const shipping = obj.shipping || obj.shipping_details || {};
  const charge = obj.charges && Array.isArray(obj.charges.data) ? obj.charges.data[0] : null;
  const billing = (charge && charge.billing_details) || {};
  return {
    name: firstText(details.name, shipping.name, billing.name),
    email: firstText(details.email, obj.customer_email, obj.receipt_email, billing.email),
    phone: firstText(details.phone, shipping.phone, billing.phone),
    address: formatAddress(details.address || shipping.address),
  };
}

function formatAddress(addr) {
  if (!addr || typeof addr !== 'object') return '';
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .join(', ');
}

function formatMoney(cents, currency) {
  const cur = String(currency || 'usd').toUpperCase();
  if (cents == null || !Number.isFinite(Number(cents))) return cur === 'USD' ? 'unknown' : `unknown ${cur}`;
  const amount = (Number(cents) / 100).toFixed(2);
  return cur === 'USD' ? `$${amount}` : `${amount} ${cur}`;
}

function fieldLabel(field) {
  if (field.label && typeof field.label === 'object' && field.label.custom) return String(field.label.custom).trim();
  if (typeof field.label === 'string' && field.label.trim()) return field.label.trim();
  if (field.key) return String(field.key);
  return 'Field';
}

function fieldValue(field) {
  if (!field || typeof field !== 'object') return '';
  if (field.text && field.text.value != null) return String(field.text.value).trim();
  if (field.numeric && field.numeric.value != null) return String(field.numeric.value).trim();
  if (field.dropdown && field.dropdown.value != null) return String(field.dropdown.value).trim();
  return '';
}

function extractCustomFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.map((field) => ({ label: fieldLabel(field), value: fieldValue(field) })).filter((field) => field.value);
}

function plainMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const out = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value == null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = String(value);
  }
  return out;
}

function extractLineItems(obj) {
  const data = obj.line_items && Array.isArray(obj.line_items.data) ? obj.line_items.data : null;
  const list = data || (Array.isArray(obj.display_items) ? obj.display_items : []);
  return list.map((item) => {
    const product = item.price && item.price.product;
    const name = firstText(item.description, product && product.name, item.name) || 'Item';
    const qty = item.quantity != null ? ` x${item.quantity}` : '';
    const cents = item.amount_total != null ? item.amount_total : item.amount;
    const amt = cents != null ? ` ${formatMoney(cents, obj.currency)}` : '';
    return `${name}${qty}${amt}`;
  });
}

function orderKeys(obj) {
  const keys = [];
  if (obj.object === 'checkout.session' && obj.id) keys.push(`cs:${obj.id}`);
  if (obj.object === 'payment_intent' && obj.id) keys.push(`pi:${obj.id}`);
  const paymentId = idOf(obj.payment_intent);
  if (paymentId) keys.push(`pi:${paymentId}`);
  const sessionId = idOf(obj.checkout_session);
  if (sessionId) keys.push(`cs:${sessionId}`);
  return keys;
}

function oneLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function buildSummary(event, obj) {
  const cents = centsOf(obj);
  const map = isMapOrder(obj, cents);
  const customer = pickCustomer(obj);
  const who = customer.name || customer.email || 'Customer';
  const amount = formatMoney(cents, obj.currency);
  const sessionId = obj.object === 'checkout.session' ? obj.id : idOf(obj.checkout_session);
  const paymentId = obj.object === 'payment_intent' ? obj.id : idOf(obj.payment_intent);
  const customFields = extractCustomFields(obj.custom_fields);
  const metadata = plainMetadata(obj.metadata);
  const description = typeof obj.description === 'string' ? obj.description.trim() : '';
  const lineItems = extractLineItems(obj);
  const instruction = map
    ? 'Draft the Map setup + reply for Jon to approve. Do not reply to the customer automatically.'
    : 'Do not reply to the customer automatically.';
  const lines = [
    map ? 'Workflow Map order' : 'Other Stripe payment',
    '',
    `Customer name: ${customer.name || '(not provided)'}`,
    `Email: ${customer.email || '(not provided)'}`,
  ];
  if (customer.phone) lines.push(`Phone: ${customer.phone}`);
  if (customer.address) lines.push(`Address: ${customer.address}`);
  lines.push(`Amount: ${amount}`);
  if (sessionId) lines.push(`Stripe session: ${sessionId}`);
  if (paymentId) lines.push(`Stripe payment: ${paymentId}`);
  lines.push(`Stripe event: ${event.id} (${event.type})`);
  if (lineItems.length) {
    lines.push('', 'Line items:');
    for (const item of lineItems) lines.push(`- ${item}`);
  }
  if (customFields.length) {
    lines.push('', 'Custom fields:');
    for (const field of customFields) lines.push(`- ${field.label}: ${field.value}`);
  }
  if (Object.keys(metadata).length) {
    lines.push('', 'Metadata:');
    for (const [key, value] of Object.entries(metadata)) lines.push(`- ${key}: ${value}`);
  }
  if (description) lines.push('', 'Description:', description);
  lines.push('', instruction, '');

  return {
    map,
    label: map ? 'Workflow Map' : 'Other Stripe payment',
    subject: map ? `NEW MAP ORDER: ${oneLine(who)} $249` : `Other Stripe payment: ${oneLine(who)} ${amount}`,
    body: lines.join('\n'),
    instruction,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    address: customer.address,
    amountCents: cents,
    amount,
    currency: String(obj.currency || 'usd').toLowerCase(),
    stripeSessionId: sessionId || '',
    stripePaymentId: paymentId || '',
    stripeEventId: event.id,
    stripeEventType: event.type,
    customFields,
    metadata,
    description,
    lineItems,
  };
}

function isEmail(value) {
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(value);
}

function encodeSubject(subject) {
  const clean = oneLine(subject);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}

function dotStuff(text) {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .flatMap((line) => {
      const chunks = [];
      const source = line.length > 900 ? line.match(/.{1,900}/g) : [line];
      for (const chunk of source) chunks.push(chunk.startsWith('.') ? `.${chunk}` : chunk);
      return chunks;
    })
    .join('\r\n');
}

function buildMessage(from, to, subject, body) {
  const headers = [
    `From: "Granite Models Automations" <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(16).toString('hex')}@granitemodels.store>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
  ];
  return `${headers.join('\r\n')}\r\n\r\n${dotStuff(body)}`;
}

function smtpSession(socket) {
  const queue = [];
  let pending = null;
  let buf = '';
  let lines = [];

  function push(message) {
    if (pending) {
      const waiter = pending;
      pending = null;
      waiter.resolve(message);
    } else {
      queue.push(message);
    }
  }

  socket.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    for (;;) {
      const idx = buf.indexOf('\n');
      if (idx < 0) break;
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      if (!line) continue;
      lines.push(line);
      if (/^\d{3} /.test(line)) {
        const code = Number(line.slice(0, 3));
        const text = lines.join('\n');
        lines = [];
        push({ code, text });
      }
    }
  });

  return {
    response() {
      if (queue.length) return Promise.resolve(queue.shift());
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SMTP timeout')), 12000);
        pending = {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          },
        };
      });
    },
    send(line) {
      socket.write(`${line}\r\n`);
    },
  };
}

function expectCode(reply, code, label) {
  if (!reply || reply.code !== code) {
    const status = reply ? reply.code : 'none';
    throw new Error(`${label} failed (${status})`);
  }
}

function smtpSend({ from, to, subject, body }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = tls.connect({
      host: SMTP_HOST,
      port: SMTP_PORT,
      servername: SMTP_HOST,
      ...(SMTP_CA ? { ca: SMTP_CA } : {}),
    });
    const smtp = smtpSession(socket);
    const fail = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err instanceof Error ? err : new Error('SMTP failed'));
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      socket.end();
      resolve();
    };
    socket.setTimeout(12000, () => fail(new Error('SMTP timeout')));
    socket.on('error', () => fail(new Error('SMTP connection failed')));
    socket.once('secureConnect', () => {
      (async () => {
        try {
          expectCode(await smtp.response(), 220, 'SMTP greeting');
          smtp.send('EHLO granitemodels.store');
          expectCode(await smtp.response(), 250, 'SMTP EHLO');
          smtp.send('AUTH LOGIN');
          expectCode(await smtp.response(), 334, 'SMTP AUTH');
          smtp.send(Buffer.from(from, 'utf8').toString('base64'));
          expectCode(await smtp.response(), 334, 'SMTP username');
          smtp.send(Buffer.from(SMTP_PASS, 'utf8').toString('base64'));
          const login = await smtp.response();
          if (!login || login.code !== 235) throw new Error('SMTP rejected the Gmail login');
          smtp.send(`MAIL FROM:<${from}>`);
          expectCode(await smtp.response(), 250, 'SMTP MAIL FROM');
          smtp.send(`RCPT TO:<${to}>`);
          expectCode(await smtp.response(), 250, 'SMTP RCPT TO');
          smtp.send('DATA');
          expectCode(await smtp.response(), 354, 'SMTP DATA');
          socket.write(`${buildMessage(from, to, subject, body)}\r\n.\r\n`);
          expectCode(await smtp.response(), 250, 'SMTP message');
          smtp.send('QUIT');
          finish();
        } catch (err) {
          fail(err);
        }
      })();
    });
  });
}

async function sendEmail(summary) {
  if (!isEmail(NOTIFY_TO)) throw new Error('NOTIFY_TO is not an email address');
  if (summary.customerEmail && NOTIFY_TO.toLowerCase() === summary.customerEmail.toLowerCase() && NOTIFY_TO.toLowerCase() !== 'granitemodels@gmail.com') {
    throw new Error('refusing to email the customer');
  }
  if (DRY_RUN) {
    log(`DRY_RUN email\nTo: ${NOTIFY_TO}\nSubject: ${summary.subject}\n${summary.body}DRY_RUN email end`);
    return;
  }
  if (!isEmail(SMTP_USER) || !SMTP_PASS) throw new Error('SMTP_USER and SMTP_PASS are required');
  await smtpSend({ from: SMTP_USER, to: NOTIFY_TO, subject: summary.subject, body: summary.body });
  log('email sent', summary.stripeEventId, summary.label);
}

async function forwardSummary(summary) {
  if (!FORWARD_URL) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const response = await fetch(FORWARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary),
      signal: ctrl.signal,
    });
    log('forward status', response.status);
  } catch (err) {
    log('forward failed', err instanceof Error ? err.message : 'error');
  } finally {
    clearTimeout(timer);
  }
}

async function notify(summary) {
  const results = await Promise.allSettled([sendEmail(summary), forwardSummary(summary)]);
  for (const result of results) {
    if (result.status === 'rejected') log('notify failed', result.reason instanceof Error ? result.reason.message : 'error');
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleEvent(event) {
  const type = event.type;
  const obj = event.data && event.data.object;
  if (!obj || typeof obj !== 'object') return;
  if (type !== 'checkout.session.completed' && type !== 'payment_intent.succeeded') {
    log('ignored', event.id, type);
    return;
  }
  if (type === 'checkout.session.completed' && obj.payment_status && obj.payment_status !== 'paid') {
    log('unpaid session', event.id, obj.payment_status);
    return;
  }
  const summary = buildSummary(event, obj);
  const keys = orderKeys(obj);
  if (keys.some((key) => seen.has(key))) {
    log('duplicate order', event.id, summary.label);
    return;
  }
  for (const key of keys) remember(key);
  log('order', event.id, type, summary.label, summary.amountCents == null ? 'unknown' : summary.amountCents);
  await Promise.race([
    notify(summary),
    sleep(12000).then(() => log('notify still running', event.id)),
  ]);
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/health' && req.method === 'GET') return text(res, 200, 'ok');
  if (path === '/health') return text(res, 405, 'method not allowed');
  if (path !== '/stripe/webhook') return text(res, 404, 'not found');
  if (req.method !== 'POST') return text(res, 405, 'method not allowed');

  let raw;
  try {
    raw = await readBody(req);
  } catch (err) {
    return text(res, err.status || 400, 'bad request');
  }

  const verified = verifySignature(raw, req.headers['stripe-signature']);
  if (!verified.ok) {
    log('rejected', verified.message);
    return text(res, verified.status, verified.message);
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch (_) {
    return text(res, 400, 'invalid json');
  }
  if (!event || typeof event !== 'object' || !event.id || !event.type) return text(res, 400, 'invalid event');

  if (seen.has(event.id)) {
    log('duplicate event', event.id);
    return text(res, 200, 'ok');
  }
  remember(event.id);

  try {
    await handleEvent(event);
  } catch (err) {
    log('handler failed', event.id, err instanceof Error ? err.message : 'error');
  }
  return text(res, 200, 'ok');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    log('error', err instanceof Error ? err.message : 'error');
    if (!res.headersSent) text(res, 500, 'error');
    else res.end();
  });
});

server.listen(PORT, () => {
  const addr = server.address();
  log(`gma-stripe-webhook listening on ${addr && addr.port ? addr.port : PORT}`);
});
