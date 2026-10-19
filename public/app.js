/* PROF CLASH — front-end (vanilla JS, no build step) */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Supabase handles the ETH email login; the Node API trusts its access token */
let sb = null;
const ETH_EMAIL = /^[^@\s]+@([a-z0-9-]+\.)*ethz\.ch$/i;
async function authHeader() {
  const { data } = sb ? await sb.auth.getSession() : { data: {} };
  return data?.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, credentials: 'same-origin', ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
  return data;
}

/* ============================================================
   Physics: Apple-style springs (damping ratio + response)
   ============================================================ */
class Spring {
  constructor(value = 0, { damping = 1, response = 0.4 } = {}) {
    this.value = value; this.target = value; this.velocity = 0;
    this.set({ damping, response });
    this.listeners = []; this.raf = 0;
  }
  set({ damping, response }) {
    this.stiffness = (2 * Math.PI / response) ** 2;
    this.damp = (4 * Math.PI * damping) / response;
  }
  onChange(fn) { this.listeners.push(fn); return this; }
  jump(v) { this.value = this.target = v; this.velocity = 0; cancelAnimationFrame(this.raf); this.raf = 0; this.emit(); }
  /** Animate from the current (presentation) value, carrying current velocity unless one is handed off. */
  to(target, velocity) {
    this.target = target;
    if (velocity !== undefined) this.velocity = velocity;
    if (reduceMotion.matches) return this.jump(target);
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.tick(t)); }
    return new Promise((r) => (this.done = r));
  }
  tick(now) {
    let dt = Math.min((now - this.last) / 1000, 1 / 30); this.last = now;
    const steps = 4; dt /= steps;
    for (let i = 0; i < steps; i++) {
      const force = -this.stiffness * (this.value - this.target) - this.damp * this.velocity;
      this.velocity += force * dt; this.value += this.velocity * dt;
    }
    this.emit();
    if (Math.abs(this.velocity) < 0.5 && Math.abs(this.value - this.target) < 0.3) {
      this.value = this.target; this.velocity = 0; this.raf = 0; this.emit(); this.done?.(); return;
    }
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }
  emit() { for (const f of this.listeners) f(this.value); }
}

/** Momentum projection (Apple's decay formula) */
const project = (v, d = 0.998) => ((v / 1000) * d) / (1 - d);
const rubberband = (o, dim, c = 0.55) => (o * dim * c) / (dim + c * Math.abs(o));

/** Transform rig: independent X / Y / rotate / scale springs on one element */
function rig(el, opts = {}) {
  const s = { x: new Spring(0, opts), y: new Spring(0, opts), r: new Spring(0, { damping: 0.8, response: 0.4 }), k: new Spring(1, { damping: 1, response: 0.25 }) };
  const apply = () => { el.style.transform = `translate3d(${s.x.value}px, ${s.y.value}px, 0) rotate(${s.r.value}deg) scale(${s.k.value})`; };
  Object.values(s).forEach((sp) => sp.onChange(apply));
  return s;
}

/* ============================================================
   Art: trophies, league badges, XP star, crests, avatars
   ============================================================ */
const TROPHY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v3h3v2a5 5 0 0 1-5 5h-.3A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.3 13H8a5 5 0 0 1-5-5V6h3V3Zm-1 5a3 3 0 0 0 2 2.8V8H5Zm14 0h-2v2.8A3 3 0 0 0 19 8Z" fill="#ffd23f" stroke="#2a1a0b" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 5.5h2v5H9z" fill="#fff6b0" opacity=".8"/></svg>`;
const trophies = (n) => `<span class="trophies">${TROPHY}${n}</span>`;

const LEAGUE_STYLE = {
  bronze: ['#f1b07a', '#b06a35', '#6b3a17'], silver: ['#f4f7fb', '#a9b3c4', '#5b6476'], gold: ['#fff09a', '#ffbf1f', '#a86d00'],
  crystal: ['#f6c9ff', '#b45ee0', '#5f1f86'], master: ['#d9dde6', '#5c6372', '#22252c'], champion: ['#ff9d8a', '#d8261b', '#6e0e08'],
  legend: ['#fff6b0', '#ffd23f', '#7a4f00'],
};
const LEAGUE_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', crystal: 'Crystal', master: 'Master', champion: 'Champion', legend: 'Legend' };
function leagueBadge(key, cls = 'league-badge') {
  const [a, b, c] = LEAGUE_STYLE[key] || LEAGUE_STYLE.bronze;
  const id = `lg${key}${Math.random().toString(36).slice(2, 7)}`;
  const legend = key === 'legend';
  return `<svg class="${cls}" viewBox="0 0 84 96" role="img" aria-label="${LEAGUE_NAME[key]} league">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
    ${legend ? '<path d="M8 22 0 6l20 8L42 0l22 14 20-8-8 16Z" fill="#ffd23f" stroke="#2a1a0b" stroke-width="3" stroke-linejoin="round"/>' : ''}
    <path d="M42 8 76 20v28c0 22-16 36-34 44C24 84 8 70 8 48V20Z" fill="url(#${id})" stroke="#2a1a0b" stroke-width="4" stroke-linejoin="round"/>
    <path d="M42 18 66 27v21c0 15-11 26-24 32-13-6-24-17-24-32V27Z" fill="rgba(255,255,255,.18)"/>
    <path d="M30 40h24v6a12 12 0 0 1-24 0Z M26 40h4v6h-4a3 3 0 0 1 0-6Z M58 40h-4v6h4a3 3 0 0 0 0-6Z M38 58h8v6h5v4H33v-4h5Z" fill="#fff" stroke="#2a1a0b" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M16 22 42 12l26 10" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

function xpStar(level) {
  return `<div class="xp-star" title="Student level ${level}"><svg viewBox="0 0 50 50"><path d="M25 2l6.5 14.5L47 18l-11.5 10.5L39 45 25 37 11 45l3.5-16.5L3 18l15.5-1.5Z" fill="#2f95e6" stroke="#2a1a0b" stroke-width="3.5" stroke-linejoin="round"/><path d="M25 8l4.6 10.3 10.9 1.1" fill="none" stroke="#bfe8ff" stroke-width="3" stroke-linecap="round"/></svg><span>${level}</span></div>`;
}

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const CREST_COLORS = [['#2f95e6', '#135aa0'], ['#e8402a', '#9a1e10'], ['#4fbf20', '#2d7d0f'], ['#c13edc', '#6c1785'], ['#ffb40a', '#c97a00'], ['#14b8a6', '#0f766e'], ['#f97316', '#9a3412']];

/** Fallback portrait: a Clash-style banner crest with initials */
function crestAvatar(p) {
  const [a, b] = CREST_COLORS[hash(p.id) % CREST_COLORS.length];
  const w = p.name.split(/\s+/).filter(Boolean);
  const ini = esc(((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase());
  return `<svg viewBox="0 0 120 120" role="img" aria-label="${esc(p.name)}">
    <rect width="120" height="120" fill="${a}"/>
    <path d="M-10 90 L130 30 V140 H-10Z" fill="${b}" opacity=".55"/>
    <circle cx="60" cy="50" r="22" fill="#ffe0bd" stroke="#2a1a0b" stroke-width="4"/>
    <path d="M22 118c4-26 20-38 38-38s34 12 38 38" fill="#fff5d9" stroke="#2a1a0b" stroke-width="4"/>
    <text x="60" y="112" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="26" fill="#fff" stroke="#2a1a0b" stroke-width="5" paint-order="stroke">${ini}</text>
  </svg>`;
}
const portrait = (p) => `<div class="portrait">${p.image ? `<img src="/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" draggable="false" onerror="this.replaceWith(document.createRange().createContextualFragment(window.__crest(${Number(p.id)})))">` : crestAvatar(p)}</div>`;
const knownProfs = new Map();
window.__crest = (id) => crestAvatar(knownProfs.get(id) || { id, name: '?' });
const remember = (list) => list.forEach((p) => knownProfs.set(p.id, p));

const DEPT_ICON = { 1: '🏛️', 2: '🌉', 11: '🧬', 23: '🔬', 20: '⚗️', 13: '🌋', 17: '📜', 24: '❤️', 5: '💻', 18: '⚡', 7: '📈', 3: '⚙️', 19: '🧱', 8: '➗', 9: '⚛️', 25: '🌳' };
function deptCrest(d) {
  const [a, b] = CREST_COLORS[hash(d.id * 7) % CREST_COLORS.length];
  return `<svg class="crest" viewBox="0 0 58 66"><path d="M29 3 54 12v20c0 16-11 26-25 31C15 58 4 48 4 32V12Z" fill="${a}" stroke="#2a1a0b" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M29 3 54 12v20c0 16-11 26-25 31Z" fill="${b}" opacity=".45"/>
    <text x="29" y="41" text-anchor="middle" font-size="24">${DEPT_ICON[d.id] || '🎓'}</text></svg>`;
}

const levelFor = (xp) => Math.floor(Math.sqrt(xp / 20)) + 1;
const levelProgress = (xp) => { const L = levelFor(xp), a = 20 * (L - 1) ** 2, b = 20 * L ** 2; return (xp - a) / (b - a); };

/* ============================================================
   Feedback: toasts, confetti
   ============================================================ */
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`; t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2200);
}
function confetti(x = innerWidth / 2, y = innerHeight / 3, n = 36) {
  if (reduceMotion.matches) return;
  const colors = ['#ffd23f', '#2f95e6', '#e8402a', '#4fbf20', '#c13edc', '#fff'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti'; c.style.background = colors[i % colors.length];
    c.style.left = `${x}px`; c.style.top = `${y}px`;
    document.body.append(c);
    const ang = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 10;
    let vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp - 8, px = 0, py = 0, rot = 0, life = 0;
    const step = () => {
      vy += 0.45; vx *= 0.985; px += vx; py += vy; rot += vx * 3; life++;
      c.style.transform = `translate(${px}px, ${py}px) rotate(${rot}deg)`; c.style.opacity = String(1 - life / 90);
      if (life < 90) requestAnimationFrame(step); else c.remove();
    };
    requestAnimationFrame(step);
  }
}

/* ============================================================
   State & top bar
   ============================================================ */
const state = { meta: null, user: null, me: null }; // user = logged-in ETH account, me = their roster/profile

async function refreshMe() {
  try { const r = await api('/api/me'); state.user = r.user; state.me = r.profile; } catch { state.user = null; state.me = null; }
  renderMe();
}

function renderMe() {
  const chip = $('#meChip');
  chip.hidden = false;
  if (!state.user) { chip.innerHTML = `<a class="btn small gold" href="#/login">Log in</a>`; return; }
  chip.innerHTML = `${state.me ? `<a href="#/setup" title="Edit your roster" style="display:flex;align-items:center;gap:8px;text-decoration:none">${xpStar(state.me.level)}
    <div class="xp-bar" aria-label="XP progress"><i style="width:${Math.round(levelProgress(state.me.xp) * 100)}%"></i></div></a>` : ''}
    <button class="btn small stone" id="logout" title="Log out ${esc(state.user.email)}" aria-label="Log out">⏻</button>`;
  $('#logout').addEventListener('click', async () => { await sb.auth.signOut(); toast('Logged out — see you on the battlefield'); });
}

function setNav(name) {
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
}

/* ============================================================
   Router
   ============================================================ */
const routes = { '': landing, login, setup, battle, leaderboard };
let cleanup = null;
async function route() {
  cleanup?.(); cleanup = null;
  closeSheet(true);
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const view = routes[name] || landing;
  setNav(name);
  app.innerHTML = '';
  window.scrollTo(0, 0);
  try { await view(arg); } catch (e) { console.error(e); app.innerHTML = `<div class="view"><div class="panel done-panel"><div class="big">💥</div><h2>Oops</h2><p>${esc(e.message)}</p></div></div>`; }
  app.focus({ preventScroll: true });
}
addEventListener('hashchange', route);

/* ============================================================
   LANDING
   ============================================================ */
async function landing() {
  setNav('');
  const [meta, top] = await Promise.all([state.meta || api('/api/meta'), api('/api/leaderboard?limit=60')]);
  state.meta = meta; remember(top);
  const withImg = top.filter((p) => p.image);
  const pool = (withImg.length >= 2 ? withImg : top).slice(0, 40);
  const pick = () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const f1 = pick(), f2 = pick();
  const titleChars = (s, d0) => [...s].map((c, i) => `<span class="ch" style="animation-delay:${d0 + i * 0.06}s">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
  const sparks = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; const r = 90 + (i % 3) * 30;
    return `<i style="--x:${Math.cos(a) * r}px;--y:${Math.sin(a) * r}px;animation-delay:${(i % 4) * 0.02}s"></i>`; }).join('');
  const mini = (p) => p ? `<div class="mini-card">${portrait(p)}<div class="nm">${esc(p.name)}</div>${trophies(p.elo)}</div>` : '';
  const podium = top.slice(0, 3);

  app.innerHTML = `
  <div class="view-enter">
    <section class="hero">
      <div class="hero-inner">
        <span class="kicker">🎓 ETH Zurich · Bachelor mandatory courses · ${meta.stats.profs} professors</span>
        <h1 class="title" aria-label="Prof Clash"><span class="line">${titleChars('PROF', 0.1)}</span><span class="line l2">${titleChars('CLASH', 0.4)}</span></h1>
        <p class="tagline">Two professors enter. One leaves with the trophies. Vote 1v1 on who taught you better — and watch the Elo ladder decide who rules the lecture hall.</p>
        <div class="arena-preview" aria-hidden="true">
          <div class="fighter left">${mini(f1)}</div>
          <div class="vs-emblem"><div class="burst"></div><div class="vs">VS</div></div>
          <div class="sparks">${sparks}</div>
          <div class="fighter right">${mini(f2)}</div>
        </div>
        <div class="hero-ctas">
          <a class="btn huge pulse" href="${state.me ? '#/battle' : state.user ? '#/setup' : '#/login/setup'}">⚔️ ${state.me ? 'Continue battle' : 'Start battle'}</a>
          <a class="btn gold" href="#/leaderboard" style="align-self:center">🏆 Leaderboard</a>
        </div>
      </div>
      <div class="scroll-hint">▼ scroll</div>
    </section>

    <div class="ground">
      <section class="section">
        <div class="stats">
          <div class="panel wood stat reveal nails"><div class="ico">🧙</div><div class="num" data-count="${meta.stats.profs}">0</div><div class="lbl">Professors</div></div>
          <div class="panel wood stat reveal nails"><div class="ico">📚</div><div class="num" data-count="${meta.stats.courses}">0</div><div class="lbl">Mandatory courses</div></div>
          <div class="panel wood stat reveal nails"><div class="ico">⚔️</div><div class="num" data-count="${meta.stats.votes}">0</div><div class="lbl">Battles fought</div></div>
          <div class="panel wood stat reveal nails"><div class="ico">🛡️</div><div class="num" data-count="${meta.depts.length}">0</div><div class="lbl">Departments</div></div>
        </div>
      </section>

      <section class="section">
        <h2 class="reveal">How the clash works</h2>
        <div class="steps">
          <div class="panel step reveal"><div class="badge-num">1</div><div class="art">🛡️</div><h3>Join your clan</h3><p>Pick your department, programme and semester. We pull the professors of your mandatory courses straight from the VVZ.</p></div>
          <div class="panel step reveal"><div class="badge-num">2</div><div class="art">🧑‍🏫</div><h3>Pick your roster</h3><p>Only professors you actually had. Tap to remove anyone you skipped — no rating people you never sat through.</p></div>
          <div class="panel step reveal"><div class="badge-num">3</div><div class="art">🏆</div><h3>Battle!</h3><p>Two cards, one choice. Tap or flick the better teacher. Elo trophies move per department and globally.</p></div>
        </div>
      </section>

      <section class="section">
        <h2 class="reveal">Climb the leagues</h2>
        <div class="leagues">
          ${meta.leagues.map((l) => `<div class="league-tile reveal">${leagueBadge(l.key)}<div class="lname">${l.name}</div><div class="lmin">${TROPHY.replace('<svg', '<svg width="16" height="16"')} ${l.min ? l.min + '+' : 'start'}</div></div>`).join('')}
        </div>
      </section>

      ${podium.length >= 3 ? `
      <section class="section">
        <h2 class="reveal">Current champions</h2>
        <div class="podium reveal">${[1, 0, 2].map((i) => podiumCol(podium[i], i + 1)).join('')}</div>
        <div style="text-align:center;margin-top:40px"><a class="btn blue" href="#/leaderboard">See the full ladder →</a></div>
      </section>` : ''}

      <footer class="footer">Course &amp; lecturer data scraped from the ETH Zurich <a href="https://www.vvz.ethz.ch" target="_blank" rel="noopener">Vorlesungsverzeichnis</a> (HS 2026 &amp; FS 2026). Portraits from public ETH department and personal pages.<br>Unofficial student project — not affiliated with ETH Zurich. Be kind: it's about teaching, not people.</footer>
    </div>
  </div>`;

  bindPodium(app);
  // Scroll reveals + count-up
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    const num = $('.num', e.target); if (num) countUp(num);
  }), { threshold: 0.2 });
  $$('.reveal', app).forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });
  // Parallax on hills
  const hills = $$('.hills path');
  const onScroll = () => { const y = scrollY; hills.forEach((h, i) => { h.style.transform = `translateY(${y * (0.05 + i * 0.07)}px)`; }); };
  if (!reduceMotion.matches) addEventListener('scroll', onScroll, { passive: true });
  cleanup = () => { removeEventListener('scroll', onScroll); hills.forEach((h) => (h.style.transform = '')); io.disconnect(); };
}

function countUp(el) {
  const to = Number(el.dataset.count) || 0;
  if (reduceMotion.matches) { el.textContent = to.toLocaleString(); return; }
  const t0 = performance.now(), dur = 1200;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - (1 - k) ** 3)).toLocaleString(); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function podiumCol(p, place) {
  return `<div class="pod p${place}" data-prof="${p.id}">${place === 1 ? '<div class="crown">👑</div>' : ''}${portrait(p)}
    <div class="block"><div class="place">${place}</div><div class="pname">${esc(p.name)}</div>${trophies(p.elo)}</div></div>`;
}
function bindPodium(root) { $$('[data-prof]', root).forEach((el) => el.addEventListener('click', () => openProf(Number(el.dataset.prof)))); }

/* ============================================================
   LOGIN — ETH email + 6-digit confirmation code
   ============================================================ */
async function login(next) {
  const go = () => { location.hash = `#/${next || (state.me ? 'battle' : 'setup')}`; };
  if (state.user) return go();
  let email = '', cooldown = 0, timer = 0;
  app.innerHTML = `<div class="view view-enter">
    <div class="setup-head"><h1>Join the clan</h1><p>Only ETH Zurich students and staff can battle. We'll email you a code to confirm it's really you.</p></div>
    <div class="panel login-panel"><div class="panel-title stroke">Log in</div>
      <form id="emailForm" class="login-step" novalidate>
        <label class="field"><span>Your ETH email</span>
          <input class="search" id="email" type="email" inputmode="email" autocomplete="email" placeholder="you@student.ethz.ch" required /></label>
        <p class="login-msg" id="emailMsg" role="alert"></p>
        <button class="btn" id="sendBtn" type="submit">📨 Send me a code</button>
      </form>
      <form id="codeForm" class="login-step" novalidate hidden>
        <p class="login-sent">We sent a code to <b id="sentTo"></b>. It can take a minute — check spam too.</p>
        <label class="field"><span>Confirmation code</span>
          <input class="search code-input" id="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="8" placeholder="••••••" required /></label>
        <p class="login-msg" id="codeMsg" role="alert"></p>
        <button class="btn" id="verifyBtn" type="submit">⚔️ Confirm &amp; enter</button>
        <div class="login-links"><button type="button" class="linkish" id="resend"></button><button type="button" class="linkish" id="changeEmail">Use another email</button></div>
      </form>
    </div></div>`;

  const emailIn = $('#email'), codeIn = $('#code');
  const paintResend = () => { const b = $('#resend'); b.disabled = cooldown > 0; b.textContent = cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'; };
  const startCooldown = () => {
    cooldown = 60; paintResend(); clearInterval(timer);
    timer = setInterval(() => { cooldown--; paintResend(); if (cooldown <= 0) clearInterval(timer); }, 1000);
  };
  cleanup = () => clearInterval(timer);

  async function send() {
    const msg = $('#emailMsg');
    email = emailIn.value.trim().toLowerCase();
    if (!ETH_EMAIL.test(email)) { msg.textContent = 'That needs to be an ETH address, e.g. you@student.ethz.ch'; emailIn.focus(); return false; }
    if (!sb) { msg.textContent = 'Login is not configured on this server yet.'; return false; }
    msg.textContent = ''; $('#sendBtn').disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    $('#sendBtn').disabled = false;
    if (error) {
      // the database rejects non-ETH signups; Supabase surfaces that as a generic "Database error"
      msg.textContent = /database/i.test(error.message) ? 'Only ETH Zurich email addresses can sign up.'
        : /rate|seconds/i.test(error.message) ? 'Too many codes requested — wait a minute and try again.' : error.message;
      return false;
    }
    $('#sentTo').textContent = email;
    $('#emailForm').hidden = true; $('#codeForm').hidden = false;
    startCooldown(); codeIn.value = ''; codeIn.focus();
    return true;
  }

  $('#emailForm').addEventListener('submit', (e) => { e.preventDefault(); send(); });
  $('#resend').addEventListener('click', async () => { if (cooldown <= 0 && await send()) toast('New code sent 📨'); });
  $('#changeEmail').addEventListener('click', () => { $('#codeForm').hidden = true; $('#emailForm').hidden = false; emailIn.focus(); });
  codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.replace(/\D/g, ''); });
  $('#codeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#codeMsg'), token = codeIn.value.trim();
    if (!/^\d{6,8}$/.test(token)) { msg.textContent = 'Enter the code from the email.'; return; }
    msg.textContent = ''; $('#verifyBtn').disabled = true;
    const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    $('#verifyBtn').disabled = false;
    if (error) { msg.textContent = /expired|invalid/i.test(error.message) ? 'That code is wrong or expired — try again or resend.' : error.message; return; }
    await refreshMe();
    toast('Welcome to the clan! 🛡️'); confetti(innerWidth / 2, innerHeight / 3, 40);
    go();
  });
  emailIn.focus();
}

/* ============================================================
   SETUP — department, programme, semester, roster
   ============================================================ */
async function setup() {
  if (!state.user) { location.hash = '#/login/setup'; return; }
  const meta = state.meta || (state.meta = await api('/api/meta'));
  const me = state.me;
  let dept = me ? meta.depts.find((d) => d.programs.some((p) => p.id === me.programId)) : null;
  let programId = me?.programId || null;
  let semester = me?.semester || null;
  let program = null;
  let selected = new Set(me?.profIds || []);
  let touched = !!me;

  app.innerHTML = `<div class="view view-enter">
    <div class="setup-head"><h1>Choose your clan</h1><p>Your department decides which professors you can battle — and which ladder your votes shape.</p></div>
    <div class="panel"><div class="panel-title stroke">Department</div><div class="dept-grid" id="depts"></div>
      <div class="field-row" id="progRow" hidden>
        <label class="field"><span>Programme</span><select class="select" id="prog"></select></label>
        <div class="field"><span>Your current semester</span><div class="sem-picker" id="sems"></div></div>
      </div>
    </div>
    <div id="rosterWrap"></div>
  </div>`;

  const depts = $('#depts');
  depts.innerHTML = meta.depts.map((d) => `<div class="dept-tile" role="button" tabindex="0" data-id="${d.id}">${deptCrest(d)}<div class="dn">${esc(d.name)}</div>
    <div class="dc">${d.programs.length} programme${d.programs.length > 1 ? 's' : ''}</div></div>`).join('');
  const chooseDept = (id) => {
    dept = meta.depts.find((d) => d.id === id);
    $$('.dept-tile', depts).forEach((t) => t.classList.toggle('sel', Number(t.dataset.id) === id));
    const sel = $('#prog');
    sel.innerHTML = dept.programs.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.profs} profs)</option>`).join('');
    if (!dept.programs.some((p) => p.id === programId)) { programId = dept.programs[0].id; touched = false; }
    sel.value = programId;
    $('#progRow').hidden = false;
    loadProgram();
  };
  depts.addEventListener('click', (e) => { const t = e.target.closest('.dept-tile'); if (t) chooseDept(Number(t.dataset.id)); });
  depts.addEventListener('keydown', (e) => { const t = e.target.closest('.dept-tile'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); chooseDept(Number(t.dataset.id)); } });
  $('#prog').addEventListener('change', (e) => { programId = Number(e.target.value); touched = false; loadProgram(); });

  const sems = $('#sems');
  sems.innerHTML = [1, 2, 3, 4, 5, 6].map((s) => `<button type="button" data-s="${s}" aria-pressed="false">${s}${s === 6 ? '+' : ''}</button>`).join('');
  sems.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    semester = Number(b.dataset.s); touched = false; paintSems(); renderRoster();
  });
  const paintSems = () => $$('button', sems).forEach((b) => { const on = Number(b.dataset.s) === semester; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });

  async function loadProgram() {
    program = await api(`/api/program?id=${programId}`);
    program.courses.forEach((c) => remember(c.profs));
    renderRoster();
  }

  function renderRoster() {
    const wrap = $('#rosterWrap');
    if (!program || !semester) { wrap.innerHTML = semester ? '' : `<p class="battle-sub" style="margin-top:30px">👆 Now pick your semester.</p>`; return; }
    const year = Math.ceil(semester / 2);
    // Group professors by the earliest study year in which they teach a mandatory course
    const groups = new Map();
    const placed = new Map();
    for (const c of program.courses) {
      const y = c.year || 0;
      const reachable = c.year ? (c.year < year || (c.year === year && (semester % 2 === 0 || c.sem === 'HS'))) : semester >= 3;
      for (const p of c.profs) {
        const prev = placed.get(p.id);
        if (prev) { prev.courses.push(c.title); prev.reachable ||= reachable; continue; }
        const entry = { p, courses: [c.title], reachable, y };
        placed.set(p.id, entry);
        if (!groups.has(y)) groups.set(y, []);
        groups.get(y).push(entry);
      }
    }
    if (!touched) selected = new Set([...placed.values()].filter((e) => e.reachable).map((e) => e.p.id));
    selected = new Set([...selected].filter((id) => placed.has(id)));
    const label = { 1: ['Year 1', 'Semester 1–2 · first-year exams'], 2: ['Year 2', 'Semester 3–4'], 3: ['Year 3', 'Semester 5–6'], 0: ['More mandatory courses', 'year not specified in VVZ'] };
    const order = [1, 2, 3, 0].filter((y) => groups.has(y));
    wrap.innerHTML = `<div class="panel roster view-enter"><div class="panel-title stroke">Your roster</div>
      <p style="text-align:center;margin:10px 0 0;color:var(--ink-soft)">We pre-selected professors you've most likely had by semester ${semester}. <b>Tap to toggle</b> — only keep the ones you really sat through.</p>
      ${order.map((y) => `<div class="year-group"><h3>${label[y][0]} <span class="pill">${label[y][1]}</span></h3><div class="prof-grid">
        ${groups.get(y).map(({ p, courses }) => `<div class="prof-pick ${selected.has(p.id) ? 'sel' : ''}" role="checkbox" tabindex="0" aria-checked="${selected.has(p.id)}" data-id="${p.id}">
          <div class="check">✔</div>${portrait(p)}<div class="nm">${esc(p.name)}</div><div class="cs">${esc([...new Set(courses)].slice(0, 2).join(' · '))}</div></div>`).join('')}
      </div></div>`).join('')}
    </div>
    <div class="dock"><span class="count" id="selCount"></span><button class="btn" id="go">⚔️ To battle!</button></div>`;
    const updateCount = () => {
      $('#selCount').textContent = `${selected.size} professors selected`;
      $('#go').disabled = selected.size < 2;
    };
    updateCount();
    const toggle = (el) => {
      const id = Number(el.dataset.id); touched = true;
      selected.has(id) ? selected.delete(id) : selected.add(id);
      el.classList.toggle('sel', selected.has(id)); el.setAttribute('aria-checked', selected.has(id));
      updateCount();
    };
    wrap.addEventListener('click', (e) => { const el = e.target.closest('.prof-pick'); if (el) toggle(el); });
    wrap.addEventListener('keydown', (e) => { const el = e.target.closest('.prof-pick'); if (el && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); toggle(el); } });
    $('#go').addEventListener('click', async () => {
      try {
        state.me = await api('/api/session', { method: 'POST', body: { programId, semester, profIds: [...selected] } });
        renderMe(); location.hash = '#/battle';
      } catch (e) { toast(e.message, 'err'); }
    });
  }

  if (semester) paintSems();
  if (dept) chooseDept(dept.id);
}

/* ============================================================
   BATTLE
   ============================================================ */
async function battle() {
  if (!state.user) { location.hash = '#/login/battle'; return; }
  if (!state.me) { location.hash = '#/setup'; return; }
  app.innerHTML = `<div class="battle-wrap view-enter">
    <div class="hud">
      <div class="panel"><span class="label">🛡️ ${esc(state.me.programName)} · Sem ${state.me.semester}</span></div>
      <div class="panel"><span class="label">Duels left</span><span class="trophies" id="left">…</span></div>
    </div>
    <h1 class="battle-title">Who taught you better?</h1>
    <p class="battle-sub">Tap a card — or grab it and flick it up — to crown the winner.</p>
    <div id="arena"></div>
    <div class="battle-actions">
      <button class="btn stone small" id="skip">🤷 Can't decide <span class="kbd">S</span></button>
      <a class="btn blue small" href="#/setup">✏️ Edit roster</a>
      <a class="btn gold small" href="#/leaderboard">🏆 Ladder</a>
    </div>
    <p class="hint-line">Keyboard: <span class="kbd">←</span> left wins · <span class="kbd">→</span> right wins</p>
  </div>`;

  let current = null, busy = false, rigs = {};

  async function next(dir = 0) {
    const data = await api('/api/matchup');
    if (data.done) {
      $('#arena').innerHTML = `<div class="panel done-panel view-enter"><div class="panel-title stroke">Victory!</div><div class="big">🏰</div>
        <h2 style="color:var(--gold-1);font-size:36px">Every duel fought!</h2><p>You judged all ${data.me.totalPairs} matchups in your roster. Your clan salutes you, level ${data.me.level} scholar.</p>
        <div class="battle-actions"><a class="btn gold" href="#/leaderboard">🏆 See the ladder</a><a class="btn blue" href="#/setup">Add professors</a></div></div>`;
      $('#left').innerHTML = `${TROPHY}0`;
      current = null; return;
    }
    current = data; remember([data.left, data.right]);
    $('#left').innerHTML = `${TROPHY}${data.remaining}`;
    const card = (p, side) => `<article class="fight-card ${side}" data-side="${side}" tabindex="0" aria-label="Vote for ${esc(p.name)}">
      ${leagueBadge(p.league)}${portrait(p)}
      <div class="fname">${esc(p.name)}</div><div class="frole">${esc(p.relationship || 'Lecturer')}</div>
      <div class="courses">${p.courses.slice(0, 3).map((c) => `<span class="chip">📘 ${esc(c.title)}</span>`).join('')}</div>
      ${trophies(p.elo)}<div class="wl">${p.wins}W · ${p.losses}L</div>
      <div class="pick-hint"><span class="btn small ${side === 'left' ? 'blue' : 'red'}">Pick</span></div>
      <div class="delta"></div></article>`;
    $('#arena').innerHTML = `<div class="arena">${card(data.left, 'left')}<div class="vs-emblem"><div class="burst"></div><div class="vs">VS</div></div>${card(data.right, 'right')}</div>`;
    rigs = {};
    for (const el of $$('.fight-card')) {
      const side = el.dataset.side;
      const r = rig(el, { damping: 0.8, response: 0.45 });
      rigs[side] = r;
      // enter from their own side (spatial consistency)
      r.x.jump(side === 'left' ? -420 : 420); r.r.jump(side === 'left' ? -14 : 14);
      r.x.to(0); r.r.to(0);
      bindDrag(el, r, side);
    }
  }

  function bindDrag(el, r, side) {
    let start = null, hist = [], dragging = false;
    el.addEventListener('pointerdown', (e) => {
      if (busy || e.button > 0) return;
      el.setPointerCapture(e.pointerId);
      start = { x: e.clientX - r.x.value, y: e.clientY - r.y.value, cx: e.clientX, cy: e.clientY }; // keep grab offset
      hist = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }]; dragging = false;
      r.k.to(0.97); // instant press feedback
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      if (!dragging && Math.hypot(e.clientX - start.cx, e.clientY - start.cy) > 10) dragging = true;
      if (!dragging) return;
      hist.push({ x: e.clientX, y: e.clientY, t: e.timeStamp }); if (hist.length > 6) hist.shift();
      let dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (dy > 0) dy = rubberband(dy, 300); // resist pulling down
      r.x.jump(dx); r.y.jump(dy); r.r.jump(dx * 0.04);
    });
    const end = (e) => {
      if (!start) return;
      const wasDrag = dragging; start = null; dragging = false; r.k.to(1);
      if (!wasDrag) { if (e.type === 'pointerup') choose(side); return; }
      const a = hist[0], b = hist[hist.length - 1], dt = Math.max(1, b.t - a.t);
      const vx = ((b.x - a.x) / dt) * 1000, vy = ((b.y - a.y) / dt) * 1000;
      const projectedY = r.y.value + project(vy);
      if (projectedY < -180) { choose(side, { vx, vy }); return; }
      r.x.to(0, vx); r.y.to(0, vy); r.r.to(0);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(side); } });
  }

  async function choose(side, vel = {}) {
    if (busy || !current) return;
    busy = true;
    const winner = current[side], loser = current[side === 'left' ? 'right' : 'left'];
    const wEl = $(`.fight-card.${side}`), lEl = $(`.fight-card.${side === 'left' ? 'right' : 'left'}`);
    const wr = rigs[side], lr = rigs[side === 'left' ? 'right' : 'left'];
    try {
      const res = await api('/api/vote', { method: 'POST', body: { winner: winner.id, loser: loser.id } });
      wEl.classList.add('won'); lEl.classList.add('lost');
      $('.delta', wEl).textContent = `+${res.delta}`; $('.delta', lEl).textContent = `−${res.delta}`;
      $('.trophies', wEl).innerHTML = `${TROPHY}${res.winner.elo}`; $('.trophies', lEl).innerHTML = `${TROPHY}${res.loser.elo}`;
      wr.x.to(0, vel.vx); wr.y.to(-24, vel.vy); wr.r.to(0); wr.k.to(1.06);
      lr.y.to(26); lr.k.to(0.94);
      const rect = wEl.getBoundingClientRect();
      confetti(rect.left + rect.width / 2, rect.top + rect.height * 0.35, 26);
      state.me = { ...state.me, xp: res.xp, level: res.level }; renderMe();
      if (res.levelUp) { toast(`⭐ Level up! You're now level ${res.level}`); confetti(innerWidth / 2, 120, 60); }
      await wait(reduceMotion.matches ? 350 : 1000);
      // exit: each card leaves toward its own side
      wr.x.to(side === 'left' ? -500 : 500); lr.x.to(side === 'left' ? 500 : -500);
      await wait(reduceMotion.matches ? 0 : 260);
    } catch (e) {
      toast(e.message, 'err');
      wr.x.to(0); wr.y.to(0); wr.r.to(0);
    }
    busy = false;
    await next();
  }

  $('#skip').addEventListener('click', async () => { if (busy) return; await api('/api/skip', { method: 'POST' }); next(); });
  const onKey = (e) => {
    if (e.target.closest('input,select,textarea')) return;
    if (e.key === 'ArrowLeft') choose('left');
    else if (e.key === 'ArrowRight') choose('right');
    else if (e.key.toLowerCase() === 's') $('#skip').click();
  };
  addEventListener('keydown', onKey);
  cleanup = () => removeEventListener('keydown', onKey);
  await next();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================================================
   LEADERBOARD
   ============================================================ */
async function leaderboard() {
  const meta = state.meta || (state.meta = await api('/api/meta'));
  let scope = 'global';
  let dept = state.me?.deptId || meta.depts[0].id;
  let rows = [];
  app.innerHTML = `<div class="view view-enter">
    <div class="lb-head"><h1>Hall of Trophies</h1>
      <div class="tabs" role="tablist"><button role="tab" data-scope="global" class="sel">🌍 Global</button><button role="tab" data-scope="dept">🛡️ Department</button></div></div>
    <div class="lb-tools">
      <select class="select" id="deptSel" hidden>${meta.depts.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
      <input class="search" id="q" type="search" placeholder="🔎 Search a professor…" aria-label="Search professor" />
    </div>
    <div id="pod"></div>
    <div class="panel lb-list"><div class="panel-title stroke" id="lbTitle">Global ladder</div><div id="rows"></div></div>
  </div>`;
  const deptSel = $('#deptSel'); deptSel.value = dept;

  async function load() {
    rows = await api(scope === 'global' ? '/api/leaderboard?limit=1000' : `/api/leaderboard?scope=dept&dept=${dept}&limit=1000`);
    remember(rows);
    $('#lbTitle').textContent = scope === 'global' ? 'Global ladder' : meta.depts.find((d) => d.id === dept)?.name || 'Department';
    paint();
  }
  function paint() {
    const q = $('#q').value.trim().toLowerCase();
    const list = q ? rows.filter((p) => (p.name + ' ' + p.department).toLowerCase().includes(q)) : rows;
    const anyVotes = rows.some((p) => p.wins + p.losses > 0);
    $('#pod').innerHTML = !q && rows.length >= 3 && anyVotes ? `<div class="podium" style="margin:30px auto 10px">${[1, 0, 2].map((i) => podiumCol(rows[i], i + 1)).join('')}</div>` : '';
    bindPodium($('#pod'));
    const shown = !q && anyVotes ? list.slice(3) : list;
    $('#rows').innerHTML = shown.length ? shown.slice(0, 300).map((p) => `<div class="lb-row" data-prof="${p.id}" tabindex="0">
      <div class="rk">${p.rank}</div>${portrait(p)}
      <div class="who"><b>${esc(p.name)}</b><small>${esc(p.department || p.relationship)}</small></div>
      ${leagueBadge(p.league)}<div>${trophies(p.elo)}<div class="wl">${p.wins}W · ${p.losses}L</div></div></div>`).join('')
      : `<div class="empty">No professors found.</div>`;
    if (!anyVotes && !q) $('#rows').insertAdjacentHTML('afterbegin', `<div class="empty">No battles yet — everyone starts at 1200 🏆. <a href="#/battle">Fight the first one!</a></div>`);
    $$('.lb-row', $('#rows')).forEach((el) => {
      el.addEventListener('click', () => openProf(Number(el.dataset.prof)));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') openProf(Number(el.dataset.prof)); });
    });
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => {
    scope = b.dataset.scope;
    $$('.tabs button').forEach((x) => x.classList.toggle('sel', x === b));
    deptSel.hidden = scope !== 'dept';
    load();
  }));
  deptSel.addEventListener('change', () => { dept = Number(deptSel.value); load(); });
  $('#q').addEventListener('input', paint);
  await load();
}

/* ============================================================
   PROFESSOR SHEET — drag down to dismiss (rubber-band + projection)
   ============================================================ */
const sheet = $('#sheet'), scrim = $('#scrim');
let sheetRig = null, sheetTrigger = null;
async function openProf(id) {
  sheetTrigger = document.activeElement;
  const p = await api(`/api/professor?id=${id}`);
  knownProfs.set(p.id, p);
  sheet.innerHTML = `<div class="grabber" id="grab"></div><button class="btn stone small close" id="closeSheet" aria-label="Close">✕</button>
    <div class="sheet-top">${portrait(p)}<div><h2>${esc(p.name)}</h2><div class="meta">${esc(p.relationship)}${p.department ? ' · ' + esc(p.department) : ''}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:8px">${leagueBadge(p.league, 'league-badge" style="width:44px;height:50px;margin:0')}${trophies(p.elo)}<span class="chip">#${p.rank} global</span></div></div></div>
    <h4>Battle record</h4><div class="rows"><div><span>Wins / Losses</span><b>${p.wins} / ${p.losses}</b></div>
      <div><span>Win rate</span><b>${p.wins + p.losses ? Math.round((100 * p.wins) / (p.wins + p.losses)) + '%' : '—'}</b></div></div>
    ${p.depts.length ? `<h4>Department ratings</h4><div class="rows">${p.depts.map((d) => `<div><span>${esc(d.name)}</span><span>${trophies(d.elo)} <small>${d.wins}W·${d.losses}L</small></span></div>`).join('')}</div>` : ''}
    <h4>Mandatory courses</h4><div class="rows">${p.courses.map((c) => `<div><span>📘 ${esc(c.title)}</span><small>${esc(c.program)} · ${c.sem}${c.year ? ' · Y' + c.year : ''}</small></div>`).join('')}</div>
    ${p.url ? `<p style="margin-top:18px"><a href="${esc(p.url)}" target="_blank" rel="noopener">Website ↗</a></p>` : ''}`;
  sheet.hidden = false; scrim.hidden = false;
  sheetRig = rig(sheet, { damping: 1, response: 0.35 });
  sheet.style.transform = '';
  const base = () => `translateX(-50%) translateY(${sheetRig.y.value}px)`;
  sheetRig.y.listeners = [() => { sheet.style.transform = base(); }];
  sheetRig.y.jump(sheet.offsetHeight + 40); sheetRig.y.to(0);
  $('#closeSheet').addEventListener('click', () => closeSheet());
  $('#closeSheet').focus({ preventScroll: true });
  bindSheetDrag();
}
function closeSheet(instant = false) {
  if (sheet.hidden) return;
  const done = () => { sheet.hidden = true; scrim.hidden = true; sheetTrigger?.focus?.({ preventScroll: true }); };
  if (instant || !sheetRig) return done();
  sheetRig.y.to(sheet.offsetHeight + 40).then(done);
  if (reduceMotion.matches) done();
}
scrim.addEventListener('click', () => closeSheet());
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
function bindSheetDrag() {
  const grab = $('#grab');
  let start = null, hist = [];
  const down = (e) => {
    if (sheet.scrollTop > 0 && e.target !== grab) return;
    start = e.clientY - sheetRig.y.value; hist = [{ y: e.clientY, t: e.timeStamp }];
    sheet.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (start === null) return;
    hist.push({ y: e.clientY, t: e.timeStamp }); if (hist.length > 6) hist.shift();
    let y = e.clientY - start;
    if (y < 0) y = rubberband(y, sheet.offsetHeight); // soft boundary going up
    sheetRig.y.jump(y);
  };
  const up = () => {
    if (start === null) return;
    start = null;
    const a = hist[0], b = hist[hist.length - 1], v = ((b.y - a.y) / Math.max(1, b.t - a.t)) * 1000;
    // decide by projected endpoint, hand off velocity
    if (sheetRig.y.value + project(v) > sheet.offsetHeight * 0.4) { sheetRig.y.velocity = v; closeSheet(); }
    else sheetRig.y.to(0, v);
  };
  grab.addEventListener('pointerdown', down);
  sheet.addEventListener('pointermove', move);
  sheet.addEventListener('pointerup', up);
  sheet.addEventListener('pointercancel', up);
}

/* ============================================================
   Boot
   ============================================================ */
(async () => {
  try {
    const cfg = await api('/api/config');
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        state.user = null; state.me = null; renderMe();
        if (/^#\/(setup|battle)/.test(location.hash)) location.hash = '#/';
      }
    });
  } catch (e) { console.error('auth unavailable', e); }
  await refreshMe();
  route();
})();
