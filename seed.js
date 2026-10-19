// Load scraped VVZ data (scraper/courses.json + scraper/people.json) into the cloud database.
// `node seed.js --schema` first applies supabase/schema.sql.
// Ratings and votes are kept; course/professor metadata is refreshed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, tx } from './db.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const C = JSON.parse(fs.readFileSync(path.join(dir, 'scraper/courses.json'), 'utf8'));
const P = JSON.parse(fs.readFileSync(path.join(dir, 'scraper/people.json'), 'utf8'));

const isProf = (p) => /professor/i.test(p.relationship || '') || /^Prof\./.test(p.fullName || '');
const cleanName = (n) => n.replace(/\(.*?\)/g, '').replace(/^((Prof\.|Dr\.|PD|em\.)\s*)+/g, '').trim();

if (process.argv.includes('--schema')) {
  await pool.query(fs.readFileSync(path.join(dir, 'supabase/schema.sql'), 'utf8'));
  console.log('schema applied');
}

await tx(async (db) => {
  for (const [id, name] of C.depts) {
    await db.query('INSERT INTO departments (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = excluded.name', [Number(id), name]);
  }
  for (const [id, p] of Object.entries(C.programs)) {
    await db.query(`INSERT INTO programs (id, dept_id, name) VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET name = excluded.name, dept_id = excluded.dept_id`, [Number(id), Number(p.dept), p.name.replace(/ Bachelor$/, '')]);
  }
  await db.query('DELETE FROM course_professors');

  const seenProf = new Set();
  const keep = [];
  let nCourses = 0;
  for (const c of C.courses) {
    const people = c.lecturers.map(([id]) => P[id]).filter((p) => p && p.fullName);
    // Only professors; if a mandatory course has no professor, keep its main lecturers so the course isn't lost.
    let chosen = people.filter(isProf);
    if (!chosen.length) chosen = people.slice(0, 2);
    if (!chosen.length) continue;
    const { rows: [course] } = await db.query(`INSERT INTO courses (code, title, program_id, semester_type, year, semester, section, vvz_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (program_id, code) DO UPDATE SET title = excluded.title, semester_type = excluded.semester_type,
        year = excluded.year, semester = excluded.semester, section = excluded.section
      RETURNING id`, [c.code, c.title, Number(c.program), c.sem.endsWith('W') ? 'HS' : 'FS', c.year ?? null, c.semester ?? null, c.section || '', c.leId]);
    keep.push(course.id);
    nCourses++;
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
  // drop courses that are no longer mandatory / no longer in the VVZ data
  await db.query('DELETE FROM courses WHERE NOT (id = ANY($1))', [keep]);
  console.log(`seeded ${Object.keys(C.programs).length} programs, ${nCourses} courses, ${seenProf.size} professors`);
});
await pool.end();
