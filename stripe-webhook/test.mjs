import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET = 'whsec_test_dummy_secret';
const SMTP_PASS = 'app-password-not-used';
const dir = dirname(fileURLToPath(import.meta.url));

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function sign(raw, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac('sha256', SECRET).update(`${timestamp}.`).update(raw).digest('hex');
  return `t=${timestamp},v1=${v1},v0=ignored`;
}

function post(port, raw, signature) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/stripe/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(raw),
          ...(signature == null ? {} : { 'Stripe-Signature': signature }),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    req.on('error', reject);
    req.end(raw);
  });
}

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  });
}

function event(id, type, object) {
  return JSON.stringify({ id, object: 'event', type, data: { object } });
}

const mapSession = event('evt_map_1', 'checkout.session.completed', {
  id: 'cs_test_123',
  object: 'checkout.session',
  amount_total: 24900,
  currency: 'usd',
  payment_status: 'paid',
  payment_intent: 'pi_test_123',
  customer_details: {
    name: 'Pat Rivera',
    email: 'pat@example.com',
    phone: '+19785551212',
    address: { line1: '1 Main St', city: 'Lowell', state: 'MA', postal_code: '01852', country: 'US' },
  },
  custom_fields: [
    {
      key: 'process',
      label: { custom: 'What comes in', type: 'custom' },
      type: 'text',
      text: { value: 'Missed calls from the website' },
    },
  ],
  metadata: { product: 'Workflow Map', notes: 'HVAC shop in Lowell' },
  line_items: { data: [{ description: 'Workflow Map', quantity: 1, amount_total: 24900 }] },
  charges: {
    data: [{
      billing_details: { name: 'Pat Rivera', email: 'pat@example.com', phone: '+19785551212' },
      payment_method_details: { card: { number: '4242424242424242', last4: '4242' } },
    }],
  },
});

const otherPayment = event('evt_other_1', 'payment_intent.succeeded', {
  id: 'pi_other_1',
  object: 'payment_intent',
  amount: 14900,
  amount_received: 14900,
  currency: 'usd',
  description: 'Steel estimating packet',
  receipt_email: 'sam@example.com',
  shipping: { name: 'Sam Lee', phone: '+19785550199' },
  metadata: { sku: 'steel-149' },
});

const phraseOnly = event('evt_phrase_1', 'checkout.session.completed', {
  id: 'cs_phrase_1',
  object: 'checkout.session',
  amount_total: 10000,
  currency: 'usd',
  payment_status: 'paid',
  payment_intent: 'pi_phrase_1',
  customer_details: { email: 'rio@example.com' },
  line_items: { data: [{ description: 'Workflow Map deposit', quantity: 1, amount_total: 10000 }] },
});

const unpaid = event('evt_unpaid_1', 'checkout.session.completed', {
  id: 'cs_unpaid_1',
  object: 'checkout.session',
  amount_total: 24900,
  currency: 'usd',
  payment_status: 'unpaid',
  payment_intent: 'pi_later_1',
  customer_details: { name: 'Later Customer', email: 'later@example.com' },
});

const laterPaid = event('evt_later_1', 'payment_intent.succeeded', {
  id: 'pi_later_1',
  object: 'payment_intent',
  amount: 24900,
  amount_received: 24900,
  currency: 'usd',
  receipt_email: 'later@example.com',
  shipping: { name: 'Later Customer' },
});

const samePayment = event('evt_map_pi', 'payment_intent.succeeded', {
  id: 'pi_test_123',
  object: 'payment_intent',
  amount: 24900,
  amount_received: 24900,
  currency: 'usd',
  description: 'Workflow Map',
  receipt_email: 'pat@example.com',
});

function count(log, needle) {
  return log.split(needle).length - 1;
}

function lastEmail(log) {
  const parts = log.split('DRY_RUN email end');
  const block = parts.length > 1 ? parts[parts.length - 2] : log;
  const start = block.lastIndexOf('DRY_RUN email');
  return start >= 0 ? block.slice(start) : block;
}

function badSign(raw) {
  return sign(raw).replace(/v1=([0-9a-f])/, (_, digit) => `v1=${digit === '0' ? '1' : '0'}`);
}

async function waitFor(read, predicate, timeout = 2000) {
  const start = Date.now();
  while (!predicate(read())) {
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for log\n${read()}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function startApp(port, extraEnv) {
  let output = '';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: dir,
    env: {
      ...process.env,
      PORT: String(port),
      STRIPE_WEBHOOK_SECRET: SECRET,
      SMTP_USER: 'granitemodels@gmail.com',
      SMTP_PASS,
      NOTIFY_TO: 'granitemodels@gmail.com',
      FORWARD_WEBHOOK_URL: '',
      DRY_RUN: '',
      SMTP_HOST: '',
      SMTP_PORT: '',
      SMTP_CA: '',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { output += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { output += chunk.toString('utf8'); });
  return {
    child,
    log: () => output,
    async ready() {
      const started = Date.now();
      while (!output.includes('listening on')) {
        if (child.exitCode != null) throw new Error(`server exited early\n${output}`);
        if (Date.now() - started > 5000) throw new Error(`server did not start\n${output}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    },
    stop() {
      if (!child.killed) child.kill();
    },
  };
}

function listen(server, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => resolve(server.address().port));
  });
}

async function smtpProof() {
  const certDir = mkdtempSync(join(tmpdir(), 'gma-smtp-'));
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048',
    '-keyout', join(certDir, 'key.pem'),
    '-out', join(certDir, 'cert.pem'),
    '-days', '1', '-nodes',
    '-subj', '/CN=127.0.0.1',
    '-addext', 'subjectAltName=IP:127.0.0.1',
  ], { stdio: 'ignore' });
  const cert = readFileSync(join(certDir, 'cert.pem'), 'utf8');
  const key = readFileSync(join(certDir, 'key.pem'), 'utf8');
  const rcpt = [];
  const messages = [];
  let authUser = '';
  let authPass = '';
  const smtp = tls.createServer({ cert, key }, (socket) => {
    let buf = '';
    let step = 'cmd';
    let dataLines = [];
    const say = (line) => socket.write(`${line}\r\n`);
    say('220 localhost ESMTP');
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      for (;;) {
        const idx = buf.indexOf('\n');
        if (idx < 0) break;
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        if (step === 'data') {
          if (line === '.') {
            step = 'cmd';
            messages.push(dataLines.join('\n'));
            dataLines = [];
            say('250 ok');
          } else {
            dataLines.push(line.startsWith('..') ? line.slice(1) : line);
          }
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) socket.write('250-localhost\r\n250 AUTH LOGIN\r\n');
        else if (cmd === 'AUTH LOGIN') { step = 'user'; say('334 VXNlcm5hbWU6'); }
        else if (step === 'user') { authUser = line; step = 'pass'; say('334 UGFzc3dvcmQ6'); }
        else if (step === 'pass') { authPass = line; step = 'cmd'; say('235 ok'); }
        else if (cmd.startsWith('MAIL FROM')) say('250 ok');
        else if (cmd.startsWith('RCPT TO')) { rcpt.push(line); say('250 ok'); }
        else if (cmd === 'DATA') { step = 'data'; say('354 go'); }
        else if (cmd === 'QUIT') { say('221 bye'); socket.end(); }
        else say('500 unknown');
      }
    });
  });
  const forwarded = [];
  const forward = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      forwarded.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      res.writeHead(204);
      res.end();
    });
  });
  const smtpPort = await listen(smtp);
  const forwardPort = await listen(forward);
  const app = startApp(await freePort(), {
    DRY_RUN: '',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtpPort),
    SMTP_CA: cert,
    FORWARD_WEBHOOK_URL: `http://127.0.0.1:${forwardPort}/hook`,
  });
  try {
    await app.ready();
    const raw = event('evt_smtp_1', 'checkout.session.completed', {
      id: 'cs_smtp_1',
      object: 'checkout.session',
      amount_total: 24900,
      currency: 'usd',
      payment_status: 'paid',
      payment_intent: 'pi_smtp_1',
      customer_details: { name: 'Pat Rivera', email: 'pat@example.com', phone: '+19785551212' },
      metadata: { notes: 'Call before visiting' },
    });
    const paid = await post(appPort(app), raw, sign(raw));
    assert.equal(paid.status, 200, paid.body);
    await waitFor(app.log, (log) => log.includes('email sent') && log.includes('forward status 204'));
    assert.equal(Buffer.from(authUser, 'base64').toString('utf8'), 'granitemodels@gmail.com');
    assert.equal(Buffer.from(authPass, 'base64').toString('utf8'), SMTP_PASS);
    assert.deepEqual(rcpt, ['RCPT TO:<granitemodels@gmail.com>']);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /To: granitemodels@gmail\.com/);
    assert.equal(messages[0].includes('To: pat@example.com'), false);
    assert.match(messages[0], /Subject: NEW MAP ORDER: Pat Rivera \$249/);
    assert.match(messages[0], /Draft the Map setup \+ reply for Jon to approve\. Do not reply to the customer automatically\./);
    assert.match(messages[0], /Call before visiting/);
    assert.equal(app.log().includes(SMTP_PASS), false);
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0].label, 'Workflow Map');
    assert.equal(forwarded[0].customerEmail, 'pat@example.com');
    assert.equal(forwarded[0].amountCents, 24900);
    assert.equal(JSON.stringify(forwarded[0]).includes('4242'), false);
  } finally {
    app.stop();
    smtp.close();
    forward.close();
    rmSync(certDir, { recursive: true, force: true });
  }

  const dead = await freePort();
  const failed = startApp(await freePort(), {
    DRY_RUN: '',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(dead),
  });
  try {
    await failed.ready();
    const raw = event('evt_smtp_fail', 'payment_intent.succeeded', {
      id: 'pi_fail_1',
      object: 'payment_intent',
      amount: 5000,
      currency: 'usd',
      receipt_email: 'sam@example.com',
      shipping: { name: 'Sam Lee' },
    });
    const response = await post(appPort(failed), raw, sign(raw));
    assert.equal(response.status, 200, response.body);
    await waitFor(failed.log, (log) => log.includes('notify failed'));
    assert.match(failed.log(), /SMTP connection failed/);
    assert.equal(failed.log().includes(SMTP_PASS), false);
  } finally {
    failed.stop();
  }
}

function appPort(app) {
  const match = app.log().match(/listening on (\d+)/);
  if (!match) throw new Error(`no listen port\n${app.log()}`);
  return Number(match[1]);
}

async function main() {
  const port = await freePort();
  let output = '';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: dir,
    env: {
      ...process.env,
      PORT: String(port),
      STRIPE_WEBHOOK_SECRET: SECRET,
      DRY_RUN: '1',
      SMTP_USER: 'granitemodels@gmail.com',
      SMTP_PASS,
      NOTIFY_TO: 'granitemodels@gmail.com',
      FORWARD_WEBHOOK_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { output += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { output += chunk.toString('utf8'); });

  const stop = () => {
    if (!child.killed) child.kill();
  };
  try {
    const started = Date.now();
    while (!output.includes('listening on')) {
      if (child.exitCode != null) throw new Error(`server exited early\n${output}`);
      if (Date.now() - started > 5000) throw new Error(`server did not start\n${output}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    const health = await get(port, '/health');
    assert.equal(health.status, 200);
    assert.equal(health.body, 'ok');

    const paid = await post(port, mapSession, sign(mapSession));
    assert.equal(paid.status, 200, paid.body);
    await waitFor(() => output, (log) => log.includes('Subject: NEW MAP ORDER: Pat Rivera $249'));
    assert.match(output, /To: granitemodels@gmail\.com/);
    assert.match(output, /Phone: \+19785551212/);
    assert.match(output, /What comes in: Missed calls from the website/);
    assert.match(output, /notes: HVAC shop in Lowell/);
    assert.match(output, /Stripe session: cs_test_123/);
    assert.match(output, /Stripe payment: pi_test_123/);
    assert.match(output, /Draft the Map setup \+ reply for Jon to approve\. Do not reply to the customer automatically\./);
    assert.equal(output.includes('To: pat@example.com'), false);
    assert.equal(output.includes('4242424242424242'), false);
    assert.equal(output.includes(SECRET), false);
    assert.equal(output.includes(SMTP_PASS), false);
    assert.equal(count(output, 'Subject: NEW MAP ORDER: Pat Rivera $249'), 1);

    const replay = await post(port, mapSession, sign(mapSession));
    assert.equal(replay.status, 200, replay.body);
    assert.equal(count(output, 'Subject: NEW MAP ORDER: Pat Rivera $249'), 1);

    const bad = await post(port, mapSession, badSign(mapSession));
    assert.equal(bad.status, 400, bad.body);
    assert.match(bad.body, /invalid signature/);
    assert.equal(count(output, 'Subject: NEW MAP ORDER: Pat Rivera $249'), 1);

    const missing = await post(port, mapSession, null);
    assert.equal(missing.status, 400, missing.body);

    const staleRaw = mapSession;
    const stale = await post(port, staleRaw, sign(staleRaw, Math.floor(Date.now() / 1000) - 301));
    assert.equal(stale.status, 400, stale.body);

    const other = await post(port, otherPayment, sign(otherPayment));
    assert.equal(other.status, 200, other.body);
    await waitFor(() => output, (log) => log.includes('Subject: Other Stripe payment: Sam Lee $149.00'));
    assert.match(output, /Phone: \+19785550199/);
    const otherEmail = lastEmail(output);
    assert.equal(otherEmail.includes('Draft the Map setup'), false);
    assert.match(otherEmail, /Do not reply to the customer automatically\./);

    const phrase = await post(port, phraseOnly, sign(phraseOnly));
    assert.equal(phrase.status, 200, phrase.body);
    await waitFor(() => output, (log) => log.includes('Subject: NEW MAP ORDER: rio@example.com $249'));
    assert.match(output, /Amount: \$100\.00/);

    const skipped = await post(port, unpaid, sign(unpaid));
    assert.equal(skipped.status, 200, skipped.body);
    assert.equal(output.includes('Later Customer'), false);

    const later = await post(port, laterPaid, sign(laterPaid));
    assert.equal(later.status, 200, later.body);
    await waitFor(() => output, (log) => log.includes('Subject: NEW MAP ORDER: Later Customer $249'));

    const duplicateOrder = await post(port, samePayment, sign(samePayment));
    assert.equal(duplicateOrder.status, 200, duplicateOrder.body);
    assert.equal(count(output, 'Subject: NEW MAP ORDER: Pat Rivera $249'), 1);

    await smtpProof();
    console.log('stripe-webhook tests passed');
  } finally {
    stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
