'use strict';
// Granite Models Automations - Post to TikTok.
// Login Kit (OAuth v2) + Content Posting API (Direct Post, FILE_UPLOAD).
// No dependencies. Tokens live only in server memory and are never logged.
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 10000);
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || 'https://granitemodels.store/tiktok/callback';
const SCOPES = 'user.info.basic,video.upload,video.publish';
const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const API = 'https://open.tiktokapis.com';
const SITE = 'https://granitemodels.store';
const CHUNK = 6 * 1000 * 1000;             // 6 MB chunks (TikTok: 5-64 MB, last chunk up to 128 MB)
const MAX_BODY = 25 * 1000 * 1000;         // largest chunk we accept from the browser
const MAX_VIDEO = 1000 * 1000 * 1000;      // 1 GB cap for this demo page
const SESSION_TTL = 12 * 3600 * 1000;
const COOKIE = 'gma_tt_sid';
const STATE_COOKIE = 'gma_tt_state';

const sessions = new Map();   // sid -> {token, openId, expires, csrf, user, upload}
setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (s.expires < now) sessions.delete(k);
}, 10 * 60 * 1000).unref();

const rid = (n = 32) => crypto.randomBytes(n).toString('base64url');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const log = (...a) => console.log(new Date().toISOString(), ...a); // never pass tokens here

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function cookie(name, value, maxAgeSec) {
  return `${name}=${encodeURIComponent(value)}; Path=/tiktok; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}
function getSession(req) {
  const sid = parseCookies(req)[COOKIE];
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s || s.expires < Date.now()) { sessions.delete(sid); return null; }
  s.sid = sid;
  return s;
}
function send(res, status, body, headers = {}) {
  const nonce = headers['x-nonce'] || '';
  delete headers['x-nonce'];
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': `default-src 'self'; img-src 'self' https: data:; media-src blob:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self' https://www.tiktok.com; frame-ancestors 'self'; base-uri 'none'`,
    ...headers,
  });
  res.end(body);
}
function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function ttApi(path, token, body, method = 'POST') {
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });
  let j = {};
  try { j = await r.json(); } catch (_) { /* ignore */ }
  const err = j.error || {};
  return { ok: r.ok && (!err.code || err.code === 'ok'), status: r.status, data: j.data || {}, error: err };
}

// ---------- HTML ----------
const CSS = `
:root{--bg:#0B1426;--card:#121c2f;--card2:#18263c;--line:#2a3d58;--ink:#f4f7fb;--muted:#c5d0df;--orange:#ff7a18;--link:#ffc48a}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(1200px 500px at 80% -10%,rgba(255,122,24,.16),transparent 55%),var(--bg);color:var(--ink);font-family:"Segoe UI",system-ui,-apple-system,sans-serif;font-size:17px;line-height:1.55}
a{color:var(--link)}header{display:flex;align-items:center;justify-content:space-between;gap:1rem;max-width:46rem;margin:0 auto;padding:1.2rem 1rem}
header a.brand{display:flex;align-items:center;gap:.6rem;color:var(--ink);text-decoration:none;font-weight:700}header img{width:40px;height:40px;border-radius:8px}
main{max-width:46rem;margin:0 auto;padding:0 1rem 3rem}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.4rem;margin:1rem 0}
h1{font-size:1.7rem;margin:.2rem 0 .6rem}h2{font-size:1.15rem;margin:0 0 .8rem}.muted{color:var(--muted)}.small{font-size:.9rem}
.btn{display:inline-flex;align-items:center;gap:.5rem;background:var(--orange);color:#1a0d04;border:0;border-radius:10px;padding:.8rem 1.2rem;font-weight:700;font-size:1rem;cursor:pointer;text-decoration:none}
.btn.dark{background:#000;color:#fff;border:1px solid #444}.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.btn[disabled]{opacity:.45;cursor:not-allowed}
.who{display:flex;align-items:center;gap:.9rem}.who img{width:56px;height:56px;border-radius:50%;border:2px solid var(--line)}
label.f{display:block;font-weight:600;margin:1rem 0 .35rem}input[type=file],textarea,select{width:100%;background:var(--card2);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:.7rem;font:inherit}
textarea{min-height:90px}video{width:100%;max-height:420px;background:#000;border-radius:10px;margin-top:.6rem}
.row{display:flex;flex-wrap:wrap;gap:1.2rem}.chk{display:flex;align-items:center;gap:.45rem}.chk.off{opacity:.45}
.switch{display:flex;align-items:center;justify-content:space-between;gap:1rem;background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:.8rem;margin-top:.6rem}
.note{background:rgba(255,122,24,.1);border:1px solid rgba(255,122,24,.4);border-radius:10px;padding:.7rem .9rem;margin-top:.6rem}
.status{font-weight:700}.err{color:#ffb4a8}.okc{color:#9be7a6}footer{max-width:46rem;margin:0 auto;padding:1rem;color:var(--muted);font-size:.85rem}
`;
function page(title, body, nonce, script = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} | Granite Models Automations</title>
<link rel="icon" href="${SITE}/assets/brand/gma-icon-192.png"><style>${CSS}</style></head><body>
<header><a class="brand" href="/"><img src="${SITE}/assets/brand/gma-icon-192.png" alt="">Granite Models Automations</a><span class="muted small">Post to TikTok</span></header>
<main>${body}</main>
<footer>&copy; Granite Models Automations &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a></footer>
${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`;
}
const TT_ICON = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#fff" d="M34 6c1 4 4 7 8 7v6c-3 0-6-1-8-3v13a11 11 0 1 1-11-11h1v6a5 5 0 1 0 4 5V6h6z"/></svg>';

function loginPage(res, msg) {
  const nonce = rid(12);
  const body = `<div class="card"><h1>Post your videos to TikTok</h1>
<p class="muted">Granite Models Automations helps trade and construction businesses publish their own project and marketing videos.
Log in with your TikTok account, pick a video, write a caption, choose who can see it, and we post it straight to your TikTok profile.</p>
${msg ? `<p class="err">${esc(msg)}</p>` : ''}
<p><a class="btn dark" href="/tiktok/login">${TT_ICON} Log in with TikTok</a></p>
<p class="muted small">We ask for: your basic profile (name and avatar), permission to upload videos, and permission to post videos you choose.
We do not store your videos or keep your login after you log out. See our <a href="/privacy/">Privacy Policy</a> and <a href="/terms/">Terms</a>.</p></div>`;
  send(res, 200, page('Log in with TikTok', body, nonce), { 'x-nonce': nonce });
}

const PRIVACY_LABELS = { PUBLIC_TO_EVERYONE: 'Everyone', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers', SELF_ONLY: 'Only me' };
const BLOCK_CODES = { spam_risk_too_many_posts: 1, spam_risk_user_banned_from_posting: 1, reached_active_user_cap: 1 };

async function postPage(res, s) {
  const nonce = rid(12);
  const ci = await ttApi('/v2/post/publish/creator_info/query/', s.token, {});
  if (!ci.ok && ci.error.code === 'access_token_invalid') { sessions.delete(s.sid); return loginPage(res, 'Your TikTok login expired. Please log in again.'); }
  const c = ci.data || {};
  s.creator = c;
  const nick = c.creator_nickname || (s.user && s.user.display_name) || 'your TikTok account';
  const avatar = c.creator_avatar_url || (s.user && s.user.avatar_url) || '';
  const blocked = !ci.ok;
  const blockMsg = BLOCK_CODES[ci.error.code] ? 'TikTok says this account cannot make more posts right now. Please try again later.'
    : blocked ? `Could not load your TikTok posting settings (${esc(ci.error.code || ci.status)}). Please try again later.` : '';
  const opts = (c.privacy_level_options || []).map((o) => `<option value="${esc(o)}">${esc(PRIVACY_LABELS[o] || o)}</option>`).join('');
  const dis = (b) => (b ? 'disabled' : '');
  const body = `
<div class="card"><div class="who">${avatar ? `<img src="${esc(avatar)}" alt="">` : ''}<div>
<div class="muted small">Posting to TikTok account</div><div style="font-size:1.25rem;font-weight:700">${esc(nick)}</div>
${c.creator_username ? `<div class="muted small">@${esc(c.creator_username)}</div>` : ''}</div>
<form method="post" action="/tiktok/logout" style="margin-left:auto"><input type="hidden" name="csrf" value="${esc(s.csrf)}"><button class="btn ghost" type="submit">Log out</button></form></div></div>
${blockMsg ? `<div class="card"><p class="err">${blockMsg}</p></div>` : ''}
<form id="f" class="card" ${blocked ? 'hidden' : ''}>
<h2>New TikTok post</h2>
<label class="f" for="file">Video file</label>
<input id="file" type="file" accept="video/mp4,video/quicktime,video/webm" required>
<div class="muted small" id="fileinfo">MP4, MOV or WebM.${c.max_video_post_duration_sec ? ` Max length for your account: ${Number(c.max_video_post_duration_sec)} seconds.` : ''}</div>
<video id="preview" controls playsinline hidden></video>
<label class="f" for="title">Caption</label>
<textarea id="title" maxlength="2200" placeholder="Write a caption. #hashtags and @mentions work."></textarea>
<label class="f" for="privacy">Who can view this video</label>
<select id="privacy" required><option value="" selected disabled>Select who can view this video</option>${opts}</select>
<div class="muted small" id="privnote"></div>
<label class="f">Allow users to</label>
<div class="row">
<label class="chk ${c.comment_disabled ? 'off' : ''}"><input type="checkbox" id="comment" ${dis(c.comment_disabled)}> Comment</label>
<label class="chk ${c.duet_disabled ? 'off' : ''}"><input type="checkbox" id="duet" ${dis(c.duet_disabled)}> Duet</label>
<label class="chk ${c.stitch_disabled ? 'off' : ''}"><input type="checkbox" id="stitch" ${dis(c.stitch_disabled)}> Stitch</label>
</div>
<div class="switch"><div><b>Disclose video content</b><div class="muted small">Turn on to disclose that this video promotes goods or services in exchange for something of value. Your video could promote yourself, a third party, or both.</div></div>
<input type="checkbox" id="disclose" aria-label="Disclose video content"></div>
<div id="discbox" hidden style="padding:.4rem .2rem">
<label class="chk"><input type="checkbox" id="yourbrand"> <span><b>Your brand</b> <span class="muted small">You are promoting yourself or your own business. This video will be classified as Brand Organic.</span></span></label>
<label class="chk" id="bclabel" style="margin-top:.5rem"><input type="checkbox" id="branded"> <span><b>Branded content</b> <span class="muted small">You are promoting another brand or a third party. This video will be classified as Branded Content.</span></span></label>
<div class="note small" id="labelnote" hidden></div>
</div>
<div class="switch"><div><b>AI-generated content</b><div class="muted small">Turn on if this video was made with AI. TikTok will label it as AI-generated.</div></div><input type="checkbox" id="aigc" aria-label="AI-generated content"></div>
<p class="small" id="declare" style="margin-top:1.2rem"></p>
<p class="muted small">After you post, it may take a few minutes for TikTok to process your video before it shows on your profile.</p>
<button class="btn" id="post" type="submit" disabled>Post to TikTok</button>
<div id="out" style="margin-top:1rem" aria-live="polite"></div>
</form>`;
  const script = `
const CSRF=${JSON.stringify(s.csrf)},MAXDUR=${Number(c.max_video_post_duration_sec) || 0};
const $=id=>document.getElementById(id);let dur=0,file=null,busy=false;
const MUC='<a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">Music Usage Confirmation</a>';
const BCP='<a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener">Branded Content Policy</a>';
function refresh(){
  const disc=$('disclose').checked,yb=$('yourbrand').checked,bc=$('branded').checked,priv=$('privacy').value;
  $('discbox').hidden=!disc;
  const selfOpt=[...$('privacy').options].find(o=>o.value==='SELF_ONLY');
  if(selfOpt){selfOpt.disabled=disc&&bc;selfOpt.title=(disc&&bc)?'Branded content visibility cannot be set to private.':'';}
  $('branded').disabled=priv==='SELF_ONLY';$('bclabel').title=priv==='SELF_ONLY'?'Branded content visibility cannot be set to private.':'';
  $('bclabel').classList.toggle('off',priv==='SELF_ONLY');
  $('privnote').textContent=(disc&&bc)?'Branded content visibility cannot be set to private.':(priv==='SELF_ONLY'&&disc?'Branded content is not available when only you can view the video.':'');
  const ln=$('labelnote');
  if(disc&&(yb||bc)){ln.hidden=false;ln.textContent=bc?"Your video will be labeled as 'Paid partnership'":"Your video will be labeled as 'Promotional content'";}else ln.hidden=true;
  $('declare').innerHTML='By posting, you agree to TikTok\\'s '+((disc&&bc)?BCP+' and ':'')+MUC+'.';
  let why='';
  if(!file)why='Choose a video file.';else if(MAXDUR&&dur>MAXDUR)why='This video is longer than your account allows ('+MAXDUR+' s).';
  else if(!priv)why='Select who can view this video.';else if(disc&&!yb&&!bc)why='You need to indicate if your content promotes yourself, a third party, or both.';
  else if(priv==='SELF_ONLY'&&disc&&bc)why='Branded content visibility cannot be set to private.';
  $('post').disabled=!!why||busy;$('post').title=why;
}
['disclose','yourbrand','branded','privacy'].forEach(id=>$(id).addEventListener('change',refresh));
$('file').addEventListener('change',()=>{
  file=$('file').files[0]||null;dur=0;const v=$('preview');
  if(!file){v.hidden=true;refresh();return;}
  v.src=URL.createObjectURL(file);v.hidden=false;
  v.onloadedmetadata=()=>{dur=v.duration||0;$('fileinfo').textContent=file.name+' - '+(file.size/1e6).toFixed(1)+' MB - '+dur.toFixed(1)+' s'+(MAXDUR&&dur>MAXDUR?' (too long: max '+MAXDUR+' s)':'');refresh();};
  refresh();
});
const out=(h)=>{$('out').innerHTML=h};
async function api(path,opts){const r=await fetch(path,Object.assign({credentials:'same-origin'},opts));let j={};try{j=await r.json()}catch(e){}if(!r.ok||j.error)throw new Error(j.error||('HTTP '+r.status));return j;}
const STAT={PROCESSING_UPLOAD:'TikTok is receiving your video...',PROCESSING_DOWNLOAD:'TikTok is receiving your video...',SEND_TO_USER_INBOX:'Sent to your TikTok inbox.',PUBLISH_COMPLETE:'Posted',FAILED:'Failed'};
$('f').addEventListener('submit',async e=>{
  e.preventDefault();refresh();if($('post').disabled)return;
  busy=true;refresh();
  try{
    out('<span class="status">Starting your post...</span>');
    const init=await api('/tiktok/api/init',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF':CSRF},body:JSON.stringify({
      title:$('title').value,privacy_level:$('privacy').value,allow_comment:$('comment').checked,allow_duet:$('duet').checked,allow_stitch:$('stitch').checked,
      disclose:$('disclose').checked,brand_organic:$('yourbrand').checked,branded_content:$('branded').checked,is_aigc:$('aigc').checked,
      video_size:file.size,mime:file.type||'video/mp4',duration:dur})});
    for(let i=0;i<init.chunks.length;i++){
      const [a,b]=init.chunks[i];
      out('<span class="status">Uploading video to TikTok... part '+(i+1)+' of '+init.chunks.length+'</span>');
      await api('/tiktok/api/chunk?index='+i,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-CSRF':CSRF},body:file.slice(a,b+1)});
    }
    const t0=Date.now();
    while(true){
      const st=await api('/tiktok/api/status',{headers:{'X-CSRF':CSRF}});
      if(st.status==='PUBLISH_COMPLETE'){out('<span class="status okc">Posted - check your TikTok profile.</span><div class="muted small">While this app is unaudited by TikTok, the post is private (Only me). It may take a few minutes to appear.</div>');break;}
      if(st.status==='FAILED'){out('<span class="status err">TikTok could not post this video'+(st.fail_reason?' ('+st.fail_reason+')':'')+'.</span>');break;}
      out('<span class="status">'+(STAT[st.status]||'Processing...')+'</span><div class="muted small">Status: '+(st.status||'waiting')+'. It may take a few minutes for your video to be processed.</div>');
      if(Date.now()-t0>240000){out('<span class="status">Still processing.</span><div class="muted small">TikTok is still processing your video. Check your TikTok profile in a few minutes.</div>');break;}
      await new Promise(r=>setTimeout(r,5000));
    }
  }catch(err){out('<span class="status err">'+String(err.message).replace(/[<>&]/g,'')+'</span>');}
  busy=false;refresh();
});
refresh();`;
  send(res, 200, page('Post to TikTok', body, nonce, script), { 'x-nonce': nonce });
}

// ---------- routes ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;

  if (p === '/tiktok/healthz') return json(res, 200, { ok: true });
  if (!CLIENT_KEY || !CLIENT_SECRET) return send(res, 503, page('Unavailable', '<div class="card"><h1>Not configured</h1><p class="muted">TikTok credentials are not set on the server.</p></div>', ''));

  if (p === '/tiktok' && m === 'GET') {
    const s = getSession(req);
    return s ? postPage(res, s) : loginPage(res, url.searchParams.get('e') === 'denied' ? 'TikTok login was cancelled.' : '');
  }

  if (p === '/tiktok/login' && m === 'GET') {
    const state = rid(24);
    const q = new URLSearchParams({ client_key: CLIENT_KEY, scope: SCOPES, response_type: 'code', redirect_uri: REDIRECT_URI, state });
    res.writeHead(302, { Location: `${AUTH_URL}?${q}`, 'Set-Cookie': cookie(STATE_COOKIE, state, 600), 'Cache-Control': 'no-store' });
    return res.end();
  }

  if (p === '/tiktok/callback' && m === 'GET') {
    const clear = cookie(STATE_COOKIE, '', 0);
    const state = url.searchParams.get('state') || '';
    const want = parseCookies(req)[STATE_COOKIE] || '';
    const bad = (msg, code = 400) => send(res, code, page('Login problem', `<div class="card"><h1>Login problem</h1><p class="err">${esc(msg)}</p><p><a class="btn" href="/tiktok">Back</a></p></div>`, ''), { 'Set-Cookie': clear });
    if (url.searchParams.get('error')) {
      res.writeHead(302, { Location: '/tiktok?e=denied', 'Set-Cookie': clear });
      return res.end();
    }
    if (!state || !want || state.length !== want.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(want))) return bad('Login check failed (state mismatch). Please try again.');
    const code = url.searchParams.get('code');
    if (!code) return bad('No authorization code received from TikTok.');
    const tr = await fetch(`${API}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body: new URLSearchParams({ client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI }),
    });
    let t = {};
    try { t = await tr.json(); } catch (_) { /* ignore */ }
    if (!tr.ok || !t.access_token) { log('token exchange failed', tr.status, t.error || ''); return bad(`TikTok login failed (${t.error || tr.status}). Please try again.`, 502); }
    const granted = String(t.scope || '').split(',');
    const s = { token: t.access_token, openId: t.open_id, csrf: rid(24), expires: Date.now() + Math.min(SESSION_TTL, (Number(t.expires_in) || 3600) * 1000), user: null, upload: null, scopes: granted };
    const ui = await ttApi('/v2/user/info/?fields=open_id,avatar_url,display_name', s.token, null, 'GET');
    if (ui.ok && ui.data.user) s.user = { display_name: ui.data.user.display_name, avatar_url: ui.data.user.avatar_url };
    if (sessions.size > 2000) sessions.clear();
    const sid = rid(32);
    sessions.set(sid, s);
    log('login ok');
    res.writeHead(302, { Location: '/tiktok', 'Set-Cookie': [clear, cookie(COOKIE, sid, Math.floor((s.expires - Date.now()) / 1000))], 'Cache-Control': 'no-store' });
    return res.end();
  }

  if (p === '/tiktok/logout' && m === 'POST') {
    const s = getSession(req);
    const form = new URLSearchParams((await readBody(req, 4096)).toString());
    if (s && form.get('csrf') === s.csrf) {
      fetch(`${API}/v2/oauth/revoke/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, token: s.token }) }).catch(() => {});
      sessions.delete(s.sid);
    }
    res.writeHead(303, { Location: '/tiktok', 'Set-Cookie': cookie(COOKIE, '', 0) });
    return res.end();
  }

  if (p.startsWith('/tiktok/api/')) {
    const s = getSession(req);
    if (!s) return json(res, 401, { error: 'Your TikTok login expired. Reload the page and log in again.' });
    if (req.headers['x-csrf'] !== s.csrf) return json(res, 403, { error: 'Security check failed. Reload the page.' });

    if (p === '/tiktok/api/init' && m === 'POST') {
      let b;
      try { b = JSON.parse((await readBody(req, 16384)).toString() || '{}'); } catch (_) { return json(res, 400, { error: 'Bad request' }); }
      const c = s.creator || {};
      const size = Math.floor(Number(b.video_size));
      if (!(size > 0) || size > MAX_VIDEO) return json(res, 400, { error: 'Video must be under 1 GB.' });
      if (!(c.privacy_level_options || []).includes(b.privacy_level)) return json(res, 400, { error: 'Select who can view this video.' });
      if (b.disclose && !b.brand_organic && !b.branded_content) return json(res, 400, { error: 'You need to indicate if your content promotes yourself, a third party, or both.' });
      if (b.disclose && b.branded_content && b.privacy_level === 'SELF_ONLY') return json(res, 400, { error: 'Branded content visibility cannot be set to private.' });
      if (c.max_video_post_duration_sec && Number(b.duration) > c.max_video_post_duration_sec) return json(res, 400, { error: `Video is longer than ${c.max_video_post_duration_sec} seconds.` });
      const mime = ['video/mp4', 'video/quicktime', 'video/webm'].includes(b.mime) ? b.mime : 'video/mp4';
      let chunkSize, count;
      if (size <= CHUNK) { chunkSize = size; count = 1; } else { chunkSize = CHUNK; count = Math.floor(size / CHUNK); }
      const chunks = [];
      for (let i = 0; i < count; i++) chunks.push([i * chunkSize, i === count - 1 ? size - 1 : (i + 1) * chunkSize - 1]);
      const post_info = {
        title: String(b.title || '').slice(0, 2200),
        privacy_level: b.privacy_level,
        disable_comment: c.comment_disabled ? true : !b.allow_comment,
        disable_duet: c.duet_disabled ? true : !b.allow_duet,
        disable_stitch: c.stitch_disabled ? true : !b.allow_stitch,
        brand_content_toggle: !!(b.disclose && b.branded_content),
        brand_organic_toggle: !!(b.disclose && b.brand_organic),
        is_aigc: !!b.is_aigc,
      };
      const r = await ttApi('/v2/post/publish/video/init/', s.token, { post_info, source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: count } });
      if (!r.ok || !r.data.upload_url) {
        log('init failed', r.status, r.error.code || '');
        const friendly = {
          unaudited_client_can_only_post_to_private_accounts: 'While this app is unaudited, TikTok only allows posting to private accounts. Set your TikTok account to Private, then try again.',
          spam_risk_too_many_posts: 'TikTok says this account cannot make more posts right now. Please try again later.',
          reached_active_user_cap: 'TikTok says this app reached its daily posting limit. Please try again later.',
          privacy_level_option_mismatch: 'Please pick one of the listed privacy options.',
        }[r.error.code];
        return json(res, 400, { error: friendly || `TikTok error: ${r.error.code || r.status}${r.error.message ? ' - ' + r.error.message : ''}` });
      }
      s.upload = { url: r.data.upload_url, publishId: r.data.publish_id, size, mime, chunks, next: 0 };
      log('post init ok');
      return json(res, 200, { chunks });
    }

    if (p === '/tiktok/api/chunk' && m === 'POST') {
      const u = s.upload;
      const i = Number(url.searchParams.get('index'));
      if (!u || i !== u.next || !u.chunks[i]) return json(res, 400, { error: 'Upload out of order. Please start again.' });
      const [a, z] = u.chunks[i];
      let buf;
      try { buf = await readBody(req, MAX_BODY); } catch (e) { return json(res, e.status || 400, { error: e.message }); }
      if (buf.length !== z - a + 1) return json(res, 400, { error: 'Upload part size mismatch. Please try again.' });
      const r = await fetch(u.url, { method: 'PUT', headers: { 'Content-Type': u.mime, 'Content-Length': String(buf.length), 'Content-Range': `bytes ${a}-${z}/${u.size}` }, body: buf });
      if (r.status !== 206 && r.status !== 201 && r.status !== 200) { log('chunk failed', r.status); return json(res, 502, { error: `TikTok upload failed (HTTP ${r.status}). Please try again.` }); }
      u.next = i + 1;
      return json(res, 200, { ok: true, done: u.next === u.chunks.length });
    }

    if (p === '/tiktok/api/status' && m === 'GET') {
      if (!s.upload) return json(res, 400, { error: 'Nothing is being posted.' });
      const r = await ttApi('/v2/post/publish/status/fetch/', s.token, { publish_id: s.upload.publishId });
      if (!r.ok) return json(res, 200, { status: 'PROCESSING', note: r.error.code || String(r.status) });
      return json(res, 200, { status: r.data.status, fail_reason: r.data.fail_reason || '' });
    }
    return json(res, 404, { error: 'Not found' });
  }

  if (p === '/' || p === '/tiktok/index.html') { res.writeHead(302, { Location: '/tiktok' }); return res.end(); }
  send(res, 404, page('Not found', '<div class="card"><h1>Not found</h1><p><a href="/tiktok">Go to Post to TikTok</a></p></div>', ''));
}

http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    log('error', e && e.message);
    if (!res.headersSent) json(res, 500, { error: 'Something went wrong. Please try again.' });
    else res.end();
  });
}).listen(PORT, () => log(`gma-tiktok-server listening on ${PORT}`));
