import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { all, one, tx, eloUpdate, league, isEthEmail, START_ELO, LEAGUES } from './db.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(dir, 'public');
const PORT = Number(process.env.PORT || 3000);
const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL / SUPABASE_ANON_KEY missing. Copy .env.example to .env and fill in your Supabase values.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------- helpers ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json' };

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
const fail = (res, status, error) => send(res, status, { error });
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new HttpError(400, 'bad json')); } });
  });
}

const voterLevel = (xp) => Math.floor(Math.sqrt(xp / 20)) + 1;
const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function profRow(p, extra = {}) {
  return {
    id: p.id, name: p.name, fullName: p.full_name, relationship: p.relationship, department: p.department,
    image: p.image, url: p.url, elo: Math.round(p.elo), wins: p.wins, losses: p.losses, league: league(p.elo), ...extra,
  };
}

// ---------- auth: Supabase access token (Bearer) → confirmed ETH user ----------
const tokenCache = new Map(); // token -> { user, until }
async function authUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const token = m[1];
  const hit = tokenCache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  const u = data.user;
  // Belt and braces: the DB trigger already blocks non-ETH signups.
  if (!u.email_confirmed_at || !isEthEmail(u.email)) return null;
  const user = { id: u.id, email: u.email.toLowerCase() };
  tokenCache.set(token, { user, until: Date.now() + 60_000 });
  if (tokenCache.size > 5000) tokenCache.clear();
  return user;
}
async function requireUser(req) {
  const u = await authUser(req);
  if (!u) throw new HttpError(401, 'Please log in with your ETH email first');
  return u;
}

async function getProfile(userId) {
  return one(`SELECT v.*, p.dept_id, p.name AS program_name, d.name AS dept_name FROM profiles v
    JOIN programs p ON p.id = v.program_id JOIN departments d ON d.id = p.dept_id WHERE v.user_id = $1`, [userId]);
}
async function requireProfile(req) {
  const u = await requireUser(req);
  const v = await getProfile(u.id);
  if (!v) throw new HttpError(428, 'Set up your roster first');
  return v;
}

async function voterSummary(v) {
  const { n } = await one('SELECT COUNT(*)::int AS n FROM votes WHERE user_id = $1', [v.user_id]);
  const k = v.profs.length;
  return { email: v.email, programId: v.program_id, programName: v.program_name, deptId: v.dept_id, deptName: v.dept_name, semester: v.semester,
    profIds: v.profs, xp: v.xp, level: voterLevel(v.xp), votes: n, totalPairs: (k * (k - 1)) / 2 };
}

// Courses a professor taught in the voter's programme (shown on the battle card)
const coursesFor = (profId, programId) => all(`SELECT c.title, c.code, c.semester_type AS sem, c.year, c.semester FROM courses c
  JOIN course_professors cp ON cp.course_id = c.id WHERE cp.prof_id = $1 AND c.program_id = $2 ORDER BY c.semester NULLS LAST`, [profId, programId]);

const lastVote = new Map();

// ---------- API ----------
const routes = {
  // public config for the browser's Supabase client (the anon key is meant to be public)
  'GET /api/config': () => ({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY }),

  'GET /api/meta': async () => {
    const depts = await all('SELECT * FROM departments WHERE id IN (SELECT dept_id FROM programs) ORDER BY name');
    const programs = await all(`SELECT p.*, (SELECT COUNT(DISTINCT cp.prof_id)::int FROM courses c JOIN course_professors cp ON cp.course_id = c.id
      WHERE c.program_id = p.id) AS profs FROM programs p ORDER BY name`);
    const stats = await one(`SELECT (SELECT COUNT(*)::int FROM professors) AS profs, (SELECT COUNT(*)::int FROM votes) AS votes,
      (SELECT COUNT(*)::int FROM profiles) AS voters, (SELECT COUNT(*)::int FROM courses) AS courses`);
    return { depts: depts.map((d) => ({ ...d, programs: programs.filter((p) => p.dept_id === d.id) })), stats, leagues: LEAGUES };
  },

  'GET /api/program': async (req, url) => {
    const id = Number(url.searchParams.get('id'));
    const prog = await one('SELECT * FROM programs WHERE id = $1', [id]);
    if (!prog) throw new HttpError(404, 'unknown programme');
    const rows = await all(`SELECT c.id AS course_id, c.title, c.code, c.semester_type, c.year, c.semester AS course_semester, p.* FROM courses c
      JOIN course_professors cp ON cp.course_id = c.id JOIN professors p ON p.id = cp.prof_id
      WHERE c.program_id = $1 ORDER BY COALESCE(c.semester, 99), c.title`, [id]);
    const courses = new Map();
    for (const r of rows) {
      if (!courses.has(r.course_id)) courses.set(r.course_id, { id: r.course_id, title: r.title, code: r.code, sem: r.semester_type, year: r.year, semester: r.course_semester, profs: [] });
      courses.get(r.course_id).profs.push(profRow(r));
    }
    return { program: prog, courses: [...courses.values()] };
  },

  // who am I? { user, profile } — profile is null until the roster is set up
  'GET /api/me': async (req) => {
    const u = await authUser(req);
    if (!u) return { user: null, profile: null };
    const v = await getProfile(u.id);
    return { user: u, profile: v ? await voterSummary(v) : null };
  },

  'POST /api/session': async (req) => {
    const u = await requireUser(req);
    const b = await readBody(req);
    const existing = await getProfile(u.id);
    // The clan (programme → department) is chosen once; afterwards it is locked so nobody can
    // hop departments to vote on more professors. Semester may only move forward.
    const programId = existing ? existing.program_id : Number(b.programId);
    const semester = Number(b.semester);
    if (existing && Number(b.programId) && Number(b.programId) !== existing.program_id) throw new HttpError(403, 'Your clan is locked — you can’t change your programme');
    if (existing && semester < existing.semester) throw new HttpError(400, 'Your semester can only go up');
    if (!(await one('SELECT 1 FROM programs WHERE id = $1', [programId]))) throw new HttpError(400, 'unknown programme');
    if (!(semester >= 1 && semester <= 12)) throw new HttpError(400, 'semester must be 1–12');
    // Only professors of mandatory courses in this programme that you can already have had
    // (course semester ≤ your semester; courses with unknown semester are allowed).
    const allowed = new Set((await all(`SELECT DISTINCT cp.prof_id AS id FROM courses c JOIN course_professors cp ON cp.course_id = c.id
      WHERE c.program_id = $1 AND (c.semester IS NULL OR c.semester <= $2)`, [programId, semester])).map((r) => r.id));
    const profIds = [...new Set((b.profIds || []).map(Number))].filter((id) => allowed.has(id));
    if (profIds.length < 2) throw new HttpError(400, 'pick at least two professors you had');
    await one(`INSERT INTO profiles (user_id, email, program_id, semester, profs) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET program_id = excluded.program_id, semester = excluded.semester, profs = excluded.profs, pending_pair = NULL`,
      [u.id, u.email, programId, semester, profIds]);
    return voterSummary(await getProfile(u.id));
  },

  'GET /api/matchup': async (req) => {
    const v = await requireProfile(req);
    const ids = v.profs;
    const voted = new Set((await all('SELECT pair FROM votes WHERE user_id = $1', [v.user_id])).map((r) => r.pair));
    const open = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (!voted.has(pairKey(ids[i], ids[j]))) open.push([ids[i], ids[j]]);
    if (!open.length) return { done: true, me: await voterSummary(v) };
    // Prefer pairs whose professors have the fewest votes from this student, then close Elo for exciting battles.
    const profs = new Map((await all('SELECT * FROM professors WHERE id = ANY($1)', [ids])).map((p) => [p.id, p]));
    const seen = new Map(ids.map((id) => [id, 0]));
    for (const pr of voted) for (const id of pr.split('-').map(Number)) seen.set(id, (seen.get(id) || 0) + 1);
    const score = ([a, b]) => seen.get(a) + seen.get(b) + Math.abs(profs.get(a).elo - profs.get(b).elo) / 200 + Math.random() * 1.5;
    open.sort((x, y) => score(x) - score(y));
    let [a, b] = open[0];
    if (Math.random() < 0.5) [a, b] = [b, a];
    await one('UPDATE profiles SET pending_pair = $1 WHERE user_id = $2', [pairKey(a, b), v.user_id]);
    const card = async (id) => profRow(profs.get(id), { courses: await coursesFor(id, v.program_id) });
    return { left: await card(a), right: await card(b), me: await voterSummary(v), remaining: open.length };
  },

  'POST /api/vote': async (req) => {
    const v = await requireProfile(req);
    const { winner, loser } = await readBody(req);
    const w = Number(winner), l = Number(loser);
    const pair = pairKey(w, l);
    if (v.pending_pair !== pair) throw new HttpError(409, 'this matchup expired — grab a new one');
    if (!v.profs.includes(w) || !v.profs.includes(l)) throw new HttpError(403, 'you can only rate professors you had');
    const now = Date.now();
    if (now - (lastVote.get(v.user_id) || 0) < 500) throw new HttpError(429, 'easy there, chief — slow down');
    lastVote.set(v.user_id, now);

    try {
      return await tx(async (db) => {
        // consume the served matchup atomically (prevents double submits)
        const took = await db.query('UPDATE profiles SET pending_pair = NULL, xp = xp + 10 WHERE user_id = $1 AND pending_pair = $2 RETURNING xp', [v.user_id, pair]);
        if (!took.rowCount) throw new HttpError(409, 'this matchup expired — grab a new one');
        await db.query('INSERT INTO votes (user_id, dept_id, winner, loser, pair) VALUES ($1, $2, $3, $4, $5)', [v.user_id, v.dept_id, w, l, pair]);
        // lock both professors in a fixed order to avoid deadlocks between concurrent votes
        const { rows } = await db.query('SELECT id, elo FROM professors WHERE id = ANY($1) ORDER BY id FOR UPDATE', [[w, l]]);
        const elo = Object.fromEntries(rows.map((r) => [r.id, r.elo]));
        const [nw, nl, delta] = eloUpdate(elo[w], elo[l]);
        await db.query('UPDATE professors SET elo = $1, wins = wins + 1 WHERE id = $2', [nw, w]);
        await db.query('UPDATE professors SET elo = $1, losses = losses + 1 WHERE id = $2', [nl, l]);
        // department rating (only students of this department influence it)
        await db.query(`INSERT INTO dept_ratings (prof_id, dept_id) VALUES ($1, $3), ($2, $3) ON CONFLICT DO NOTHING`, [w, l, v.dept_id]);
        const dr = await db.query('SELECT prof_id, elo FROM dept_ratings WHERE dept_id = $1 AND prof_id = ANY($2) ORDER BY prof_id FOR UPDATE', [v.dept_id, [w, l]]);
        const de = Object.fromEntries(dr.rows.map((r) => [r.prof_id, r.elo]));
        const [dw, dl, ddelta] = eloUpdate(de[w], de[l]);
        await db.query('UPDATE dept_ratings SET elo = $1, wins = wins + 1 WHERE prof_id = $2 AND dept_id = $3', [dw, w, v.dept_id]);
        await db.query('UPDATE dept_ratings SET elo = $1, losses = losses + 1 WHERE prof_id = $2 AND dept_id = $3', [dl, l, v.dept_id]);
        const xp = took.rows[0].xp;
        return { delta: Math.round(delta), deptDelta: Math.round(ddelta), winner: { id: w, elo: Math.round(nw), league: league(nw) },
          loser: { id: l, elo: Math.round(nl), league: league(nl) }, xp, level: voterLevel(xp), levelUp: voterLevel(xp) > voterLevel(xp - 10) };
      });
    } catch (e) {
      if (e.code === '23505') throw new HttpError(409, 'you already judged this duel');
      throw e;
    }
  },

  'POST /api/skip': async (req) => {
    const u = await authUser(req);
    if (u) await one('UPDATE profiles SET pending_pair = NULL WHERE user_id = $1', [u.id]);
    return { ok: true };
  },

  'GET /api/leaderboard': async (req, url) => {
    const scope = url.searchParams.get('scope') || 'global';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 1000);
    if (scope === 'dept') {
      const dept = Number(url.searchParams.get('dept'));
      const rows = await all(`SELECT p.*, COALESCE(d.elo, ${START_ELO}) AS delo, COALESCE(d.wins, 0) AS dwins, COALESCE(d.losses, 0) AS dlosses
        FROM professors p LEFT JOIN dept_ratings d ON d.prof_id = p.id AND d.dept_id = $1
        WHERE p.id IN (SELECT cp.prof_id FROM course_professors cp JOIN courses c ON c.id = cp.course_id JOIN programs g ON g.id = c.program_id WHERE g.dept_id = $1)
        ORDER BY delo DESC, dwins DESC, p.name LIMIT $2`, [dept, limit]);
      return rows.map((p, i) => profRow({ ...p, elo: p.delo, wins: p.dwins, losses: p.dlosses }, { rank: i + 1 }));
    }
    const rows = await all('SELECT * FROM professors ORDER BY elo DESC, wins DESC, name LIMIT $1', [limit]);
    return rows.map((p, i) => profRow(p, { rank: i + 1 }));
  },

  'GET /api/professor': async (req, url) => {
    const id = Number(url.searchParams.get('id'));
    const p = await one('SELECT * FROM professors WHERE id = $1', [id]);
    if (!p) throw new HttpError(404, 'not found');
    const courses = await all(`SELECT c.title, c.code, c.semester_type AS sem, c.year, g.name AS program FROM courses c
      JOIN course_professors cp ON cp.course_id = c.id JOIN programs g ON g.id = c.program_id WHERE cp.prof_id = $1`, [id]);
    const depts = (await all('SELECT d.name, r.elo, r.wins, r.losses FROM dept_ratings r JOIN departments d ON d.id = r.dept_id WHERE r.prof_id = $1 ORDER BY r.elo DESC', [id]))
      .map((r) => ({ ...r, elo: Math.round(r.elo), league: league(r.elo) }));
    const { r: rank } = await one('SELECT COUNT(*)::int + 1 AS r FROM professors WHERE elo > $1', [p.elo]);
    return profRow(p, { courses, depts, rank });
  },
};

// ---------- server ----------
const VENDOR = { '/vendor/supabase.js': path.join(dir, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js') };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const handler = routes[`${req.method} ${url.pathname}`];
  if (handler) {
    try {
      return send(res, 200, await handler(req, url, res));
    } catch (e) {
      if (e instanceof HttpError) return fail(res, e.status, e.message);
      console.error(e);
      return fail(res, 500, 'server error');
    }
  }
  if (url.pathname.startsWith('/api/')) return fail(res, 404, 'not found');
  if (VENDOR[url.pathname]) {
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=86400' });
    return fs.createReadStream(VENDOR[url.pathname]).pipe(res);
  }
  // static files (SPA fallback to index.html)
  let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
  if (!file.startsWith(PUBLIC)) return fail(res, 403, 'forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': file.includes('/img/') ? 'public, max-age=86400' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => console.log(`ProfClash running on http://localhost:${PORT}`));
