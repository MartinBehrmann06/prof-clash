import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { open, eloUpdate, league, START_ELO, LEAGUES } from './db.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(dir, 'public');
const PORT = Number(process.env.PORT || 3000);
const db = open();

// ---------- helpers ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json' };

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
const fail = (res, status, error) => send(res, status, { error });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('bad json')); } });
  });
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]));
}

const voterLevel = (xp) => Math.floor(Math.sqrt(xp / 20)) + 1;

function profRow(p, extra = {}) {
  return {
    id: p.id, name: p.name, fullName: p.full_name, relationship: p.relationship, department: p.department,
    image: p.image, url: p.url, elo: Math.round(p.elo), wins: p.wins, losses: p.losses, league: league(p.elo), ...extra,
  };
}

function getVoter(req) {
  const t = cookies(req).pc_token;
  if (!t) return null;
  const v = db.prepare('SELECT v.*, p.dept_id, p.name AS program_name FROM voters v JOIN programs p ON p.id = v.program_id WHERE token = ?').get(t);
  if (v) v.profIds = JSON.parse(v.profs);
  return v;
}

function voterSummary(v) {
  const votes = db.prepare('SELECT COUNT(*) AS n FROM votes WHERE voter = ?').get(v.token).n;
  const n = v.profIds.length;
  return { programId: v.program_id, programName: v.program_name, deptId: v.dept_id, semester: v.semester,
    profIds: v.profIds, xp: v.xp, level: voterLevel(v.xp), votes, totalPairs: (n * (n - 1)) / 2 };
}

// Courses a professor taught in the voter's programme (shown on the battle card)
const coursesFor = db.prepare(`SELECT c.title, c.code, c.semester_type AS sem, c.year FROM courses c
  JOIN course_professors cp ON cp.course_id = c.id WHERE cp.prof_id = ? AND c.program_id = ? ORDER BY c.year`);

// pending matchup per voter, so a vote must correspond to a served pair
const pending = new Map();
const lastVote = new Map();

// ---------- API ----------
const routes = {
  'GET /api/meta': () => {
    const depts = db.prepare('SELECT * FROM departments WHERE id IN (SELECT dept_id FROM programs) ORDER BY name').all();
    const programs = db.prepare(`SELECT p.*, (SELECT COUNT(DISTINCT cp.prof_id) FROM courses c JOIN course_professors cp ON cp.course_id = c.id
      WHERE c.program_id = p.id) AS profs FROM programs p ORDER BY name`).all();
    const stats = db.prepare('SELECT (SELECT COUNT(*) FROM professors) AS profs, (SELECT COUNT(*) FROM votes) AS votes, (SELECT COUNT(*) FROM voters) AS voters, (SELECT COUNT(*) FROM courses) AS courses').get();
    return { depts: depts.map((d) => ({ ...d, programs: programs.filter((p) => p.dept_id === d.id) })), stats, leagues: LEAGUES };
  },

  'GET /api/program': (req, url) => {
    const id = Number(url.searchParams.get('id'));
    const prog = db.prepare('SELECT * FROM programs WHERE id = ?').get(id);
    if (!prog) return [404, 'unknown programme'];
    const rows = db.prepare(`SELECT c.id AS course_id, c.title, c.code, c.semester_type, c.year, p.* FROM courses c
      JOIN course_professors cp ON cp.course_id = c.id JOIN professors p ON p.id = cp.prof_id
      WHERE c.program_id = ? ORDER BY COALESCE(c.year, 9), c.semester_type DESC, c.title`).all(id);
    const courses = new Map();
    for (const r of rows) {
      if (!courses.has(r.course_id)) courses.set(r.course_id, { id: r.course_id, title: r.title, code: r.code, sem: r.semester_type, year: r.year, profs: [] });
      courses.get(r.course_id).profs.push(profRow(r));
    }
    return { program: prog, courses: [...courses.values()] };
  },

  'GET /api/me': (req) => {
    const v = getVoter(req);
    return v ? voterSummary(v) : null;
  },

  'POST /api/session': async (req, url, res) => {
    const b = await readBody(req);
    const programId = Number(b.programId), semester = Number(b.semester);
    if (!db.prepare('SELECT 1 FROM programs WHERE id = ?').get(programId)) return [400, 'unknown programme'];
    if (!(semester >= 1 && semester <= 12)) return [400, 'semester must be 1–12'];
    // Only professors who actually teach mandatory courses in this programme may be picked.
    const allowed = new Set(db.prepare(`SELECT DISTINCT cp.prof_id AS id FROM courses c JOIN course_professors cp ON cp.course_id = c.id
      WHERE c.program_id = ?`).all(programId).map((r) => r.id));
    const profIds = [...new Set((b.profIds || []).map(Number))].filter((id) => allowed.has(id));
    if (profIds.length < 2) return [400, 'pick at least two professors you had'];
    let token = cookies(req).pc_token;
    const existing = token && db.prepare('SELECT token FROM voters WHERE token = ?').get(token);
    if (existing) {
      db.prepare('UPDATE voters SET program_id = ?, semester = ?, profs = ? WHERE token = ?').run(programId, semester, JSON.stringify(profIds), token);
    } else {
      token = crypto.randomBytes(18).toString('base64url');
      db.prepare('INSERT INTO voters (token, program_id, semester, profs) VALUES (?, ?, ?, ?)').run(token, programId, semester, JSON.stringify(profIds));
    }
    res.setHeader('Set-Cookie', `pc_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
    pending.delete(token);
    return voterSummary(getVoter({ headers: { cookie: `pc_token=${token}` } }));
  },

  'GET /api/matchup': (req) => {
    const v = getVoter(req);
    if (!v) return [401, 'set up your profile first'];
    const ids = v.profIds;
    const voted = new Set(db.prepare('SELECT pair FROM votes WHERE voter = ?').all(v.token).map((r) => r.pair));
    const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    const open = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (!voted.has(key(ids[i], ids[j]))) open.push([ids[i], ids[j]]);
    if (!open.length) return { done: true, me: voterSummary(v) };
    // Prefer pairs whose professors have the fewest votes from this student, then close Elo for exciting battles.
    const profs = new Map(db.prepare(`SELECT * FROM professors WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids).map((p) => [p.id, p]));
    const seen = new Map(ids.map((id) => [id, 0]));
    for (const pr of voted) for (const id of pr.split('-').map(Number)) seen.set(id, (seen.get(id) || 0) + 1);
    const score = ([a, b]) => seen.get(a) + seen.get(b) + Math.abs(profs.get(a).elo - profs.get(b).elo) / 200 + Math.random() * 1.5;
    open.sort((x, y) => score(x) - score(y));
    let [a, b] = open[0];
    if (Math.random() < 0.5) [a, b] = [b, a];
    pending.set(v.token, key(a, b));
    const card = (id) => profRow(profs.get(id), { courses: coursesFor.all(id, v.program_id) });
    return { left: card(a), right: card(b), me: voterSummary(v), remaining: open.length };
  },

  'POST /api/vote': async (req) => {
    const v = getVoter(req);
    if (!v) return [401, 'set up your profile first'];
    const { winner, loser } = await readBody(req);
    const w = Number(winner), l = Number(loser);
    const pair = w < l ? `${w}-${l}` : `${l}-${w}`;
    if (pending.get(v.token) !== pair) return [409, 'this matchup expired — grab a new one'];
    if (!v.profIds.includes(w) || !v.profIds.includes(l)) return [403, 'you can only rate professors you had'];
    const now = Date.now();
    if (now - (lastVote.get(v.token) || 0) < 500) return [429, 'easy there, chief — slow down'];
    lastVote.set(v.token, now);
    pending.delete(v.token);

    const pw = db.prepare('SELECT elo FROM professors WHERE id = ?').get(w);
    const pl = db.prepare('SELECT elo FROM professors WHERE id = ?').get(l);
    const [nw, nl, delta] = eloUpdate(pw.elo, pl.elo);
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO votes (voter, dept_id, winner, loser, pair) VALUES (?, ?, ?, ?, ?)').run(v.token, v.dept_id, w, l, pair);
      db.prepare('UPDATE professors SET elo = ?, wins = wins + 1 WHERE id = ?').run(nw, w);
      db.prepare('UPDATE professors SET elo = ?, losses = losses + 1 WHERE id = ?').run(nl, l);
      // department rating (only students of this department influence it)
      const ensure = db.prepare('INSERT OR IGNORE INTO dept_ratings (prof_id, dept_id) VALUES (?, ?)');
      ensure.run(w, v.dept_id); ensure.run(l, v.dept_id);
      const dr = db.prepare('SELECT elo FROM dept_ratings WHERE prof_id = ? AND dept_id = ?');
      const [dw, dl, ddelta] = eloUpdate(dr.get(w, v.dept_id).elo, dr.get(l, v.dept_id).elo);
      db.prepare('UPDATE dept_ratings SET elo = ?, wins = wins + 1 WHERE prof_id = ? AND dept_id = ?').run(dw, w, v.dept_id);
      db.prepare('UPDATE dept_ratings SET elo = ?, losses = losses + 1 WHERE prof_id = ? AND dept_id = ?').run(dl, l, v.dept_id);
      db.prepare('UPDATE voters SET xp = xp + 10 WHERE token = ?').run(v.token);
      db.exec('COMMIT');
      const before = voterLevel(v.xp);
      return { delta: Math.round(delta), deptDelta: Math.round(ddelta), winner: { id: w, elo: Math.round(nw), league: league(nw) },
        loser: { id: l, elo: Math.round(nl), league: league(nl) }, xp: v.xp + 10, level: voterLevel(v.xp + 10), levelUp: voterLevel(v.xp + 10) > before };
    } catch (e) {
      db.exec('ROLLBACK');
      if (String(e.message).includes('UNIQUE')) return [409, 'you already judged this duel'];
      throw e;
    }
  },

  'POST /api/skip': (req) => {
    const v = getVoter(req);
    if (v) pending.delete(v.token);
    return { ok: true };
  },

  'GET /api/leaderboard': (req, url) => {
    const scope = url.searchParams.get('scope') || 'global';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 1000);
    if (scope === 'dept') {
      const dept = Number(url.searchParams.get('dept'));
      const rows = db.prepare(`SELECT p.*, COALESCE(d.elo, ${START_ELO}) AS delo, COALESCE(d.wins, 0) AS dwins, COALESCE(d.losses, 0) AS dlosses
        FROM professors p LEFT JOIN dept_ratings d ON d.prof_id = p.id AND d.dept_id = ?
        WHERE p.id IN (SELECT cp.prof_id FROM course_professors cp JOIN courses c ON c.id = cp.course_id JOIN programs g ON g.id = c.program_id WHERE g.dept_id = ?)
        ORDER BY delo DESC, dwins DESC, p.name LIMIT ?`).all(dept, dept, limit);
      return rows.map((p, i) => profRow({ ...p, elo: p.delo, wins: p.dwins, losses: p.dlosses }, { rank: i + 1 }));
    }
    const rows = db.prepare('SELECT * FROM professors ORDER BY elo DESC, wins DESC, name LIMIT ?').all(limit);
    return rows.map((p, i) => profRow(p, { rank: i + 1 }));
  },

  'GET /api/professor': (req, url) => {
    const id = Number(url.searchParams.get('id'));
    const p = db.prepare('SELECT * FROM professors WHERE id = ?').get(id);
    if (!p) return [404, 'not found'];
    const courses = db.prepare(`SELECT c.title, c.code, c.semester_type AS sem, c.year, g.name AS program FROM courses c
      JOIN course_professors cp ON cp.course_id = c.id JOIN programs g ON g.id = c.program_id WHERE cp.prof_id = ?`).all(id);
    const depts = db.prepare('SELECT d.name, r.elo, r.wins, r.losses FROM dept_ratings r JOIN departments d ON d.id = r.dept_id WHERE r.prof_id = ? ORDER BY r.elo DESC').all(id)
      .map((r) => ({ ...r, elo: Math.round(r.elo), league: league(r.elo) }));
    const rank = db.prepare('SELECT COUNT(*) + 1 AS r FROM professors WHERE elo > ?').get(p.elo).r;
    return profRow(p, { courses, depts, rank });
  },
};

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const handler = routes[`${req.method} ${url.pathname}`];
  if (handler) {
    try {
      const out = await handler(req, url, res);
      if (Array.isArray(out) && typeof out[0] === 'number' && typeof out[1] === 'string') return fail(res, out[0], out[1]);
      return send(res, 200, out);
    } catch (e) {
      console.error(e);
      return fail(res, 500, 'server error');
    }
  }
  if (url.pathname.startsWith('/api/')) return fail(res, 404, 'not found');
  // static files (SPA fallback to index.html)
  let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
  if (!file.startsWith(PUBLIC)) return fail(res, 403, 'forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': file.includes('/img/') ? 'public, max-age=86400' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => console.log(`ProfClash running on http://localhost:${PORT}`));
