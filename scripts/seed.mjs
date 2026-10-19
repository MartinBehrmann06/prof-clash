// Load the scraped VVZ data into the database.
//   node scripts/seed.mjs            refresh catalogue (ratings, votes and profiles are kept)
//   node scripts/seed.mjs --schema   apply supabase/schema.sql first
//
// Inputs (scraper/): courses.json (current study year) + courses_<term>.json (older terms)
// and people.json (lecturer details). Each course row is one offering: programme × code × term.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scraper = path.join(root, 'scraper');
const read = (f) => JSON.parse(fs.readFileSync(path.join(scraper, f), 'utf8'));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const isProf = (p) => /professor/i.test(p.relationship || '') || /^Prof\./.test(p.fullName || '');
const cleanName = (n) => n.replace(/\(.*?\)/g, '').replace(/[()]/g, '').replace(/^((Prof\.|Dr\.|PD|em\.)\s*)+/g, '').replace(/\s+/g, ' ').trim();
const termIdx = (t) => Number(t.slice(0, 4)) * 2 + (t.endsWith('W') ? 1 : 0);

// --- gather offerings from all term files ---
const base = read('courses.json');
const files = fs.readdirSync(scraper).filter((f) => /^courses_\d{4}[WS]\.json$/.test(f));
const offerings = [...base.courses, ...files.flatMap((f) => read(f).courses)].map((c) => ({ ...c, term: c.sem }));
const People = read('people.json');

// Older VVZ terms sometimes name sections without a semester: borrow it from the same
// course in another term of the same programme (courses keep their slot in the curriculum).
const knownSem = new Map();
for (const c of offerings) if (c.semester) {
  const k = `${c.program}|${c.code}`;
  const prev = knownSem.get(k);
  if (!prev || termIdx(c.term) > prev.t) knownSem.set(k, { s: c.semester, t: termIdx(c.term) });
}
for (const c of offerings) if (!c.semester) {
  const k = knownSem.get(`${c.program}|${c.code}`);
  if (k) c.semester = k.s;
}

async function main() {
  if (process.argv.includes('--schema')) {
    await pool.query(fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8'));
    console.log('schema applied');
  }
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    for (const [id, name] of base.depts) {
      await db.query('INSERT INTO departments (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = excluded.name', [Number(id), name]);
    }
    for (const [id, p] of Object.entries(base.programs)) {
      await db.query(`INSERT INTO programs (id, dept_id, name) VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET name = excluded.name, dept_id = excluded.dept_id`, [Number(id), Number(p.dept), p.name.replace(/ Bachelor$/, '')]);
    }
    await db.query('DELETE FROM course_professors');

    const seenProf = new Set();
    const keep = [];
    for (const c of offerings) {
      const people = c.lecturers.map(([id]) => People[id]).filter((p) => p && p.fullName);
      // only professors; if a mandatory course has none, keep its main lecturers so the course isn't lost
      let chosen = people.filter(isProf);
      if (!chosen.length) chosen = people.slice(0, 2);
      if (!chosen.length) continue;
      const { rows: [course] } = await db.query(`INSERT INTO courses (code, title, program_id, term, semester_type, year, semester, section, vvz_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (program_id, code, term) DO UPDATE SET title = excluded.title, semester_type = excluded.semester_type,
          year = excluded.year, semester = excluded.semester, section = excluded.section, vvz_id = excluded.vvz_id
        RETURNING id`,
        [c.code, c.title, Number(c.program), c.term, c.term.endsWith('W') ? 'HS' : 'FS',
         c.semester ? Math.ceil(c.semester / 2) : null, c.semester ?? null, c.section || '', c.leId]);
      keep.push(course.id);
      for (const p of chosen) {
        if (!seenProf.has(p.id)) {
          await db.query(`INSERT INTO professors (id, name, full_name, relationship, department, field, url, image, image_source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET name = excluded.name, full_name = excluded.full_name, relationship = excluded.relationship,
              department = excluded.department, field = excluded.field, url = excluded.url, image = excluded.image, image_source = excluded.image_source`,
            [Number(p.id), cleanName(p.fullName), p.fullName, p.relationship || '', p.department || '', p.field || '', p.url || '', p.image || null, p.imageSource || null]);
          seenProf.add(p.id);
        }
        await db.query('INSERT INTO course_professors (course_id, prof_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [course.id, Number(p.id)]);
      }
    }
    // drop offerings that are no longer in the data (incl. pre-v3 rows without a term)
    await db.query('DELETE FROM courses WHERE NOT (id = ANY($1))', [keep]);

    // profiles created before v3 have no cohort yet: derive it from their semester
    const now = new Date(), m = now.getMonth(), y = now.getFullYear();
    const cur = m >= 7 ? `${y}W` : m === 0 ? `${y - 1}W` : `${y}S`;
    const { rows: legacy } = await db.query('SELECT user_id, semester FROM profiles WHERE start_term IS NULL');
    for (const r of legacy) {
      let i = termIdx(cur);
      if ((r.semester % 2 === 1) !== cur.endsWith('W')) i -= 1;
      i -= r.semester - 1;
      await db.query('UPDATE profiles SET start_term = $1 WHERE user_id = $2', [`${Math.floor(i / 2)}${i % 2 ? 'W' : 'S'}`, r.user_id]);
    }

    await db.query('COMMIT');
    const terms = [...new Set(offerings.map((c) => c.term))].sort();
    console.log(`seeded ${keep.length} course offerings over ${terms.join(', ')}; ${seenProf.size} professors; ${legacy.length} profiles got a start term`);
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
    await pool.end();
  }
}
await main();
