// Load scraped VVZ data (scraper/courses.json + scraper/people.json) into SQLite.
// Ratings and votes are kept; course/professor metadata is refreshed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from './db.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const C = JSON.parse(fs.readFileSync(path.join(dir, 'scraper/courses.json'), 'utf8'));
const P = JSON.parse(fs.readFileSync(path.join(dir, 'scraper/people.json'), 'utf8'));

const isProf = (p) => /professor/i.test(p.relationship || '') || /^Prof\./.test(p.fullName || '');
const cleanName = (n) => n.replace(/\(.*?\)/g, '').replace(/^((Prof\.|Dr\.|PD|em\.)\s*)+/g, '').trim();

const db = open();
db.exec('BEGIN');
try {
  const insDept = db.prepare('INSERT INTO departments (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name');
  for (const [id, name] of C.depts) insDept.run(Number(id), name);

  const insProg = db.prepare('INSERT INTO programs (id, dept_id, name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, dept_id = excluded.dept_id');
  for (const [id, p] of Object.entries(C.programs)) {
    insProg.run(Number(id), Number(p.dept), p.name.replace(/ Bachelor$/, ''));
  }

  const insProf = db.prepare(`INSERT INTO professors (id, name, full_name, relationship, department, field, url, image, image_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, full_name = excluded.full_name, relationship = excluded.relationship,
      department = excluded.department, field = excluded.field, url = excluded.url, image = excluded.image, image_source = excluded.image_source`);
  const insCourse = db.prepare(`INSERT INTO courses (code, title, program_id, semester_type, year, section, vvz_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(program_id, code) DO UPDATE SET title = excluded.title, year = excluded.year, section = excluded.section
    RETURNING id`);
  const insCP = db.prepare('INSERT OR IGNORE INTO course_professors (course_id, prof_id) VALUES (?, ?)');
  db.exec('DELETE FROM course_professors');

  const seenProf = new Set();
  let nCourses = 0;
  for (const c of C.courses) {
    const people = c.lecturers.map(([id]) => P[id]).filter((p) => p && p.fullName);
    // Only professors; if a mandatory course has no professor, keep its main lecturers so the course isn't lost.
    let chosen = people.filter(isProf);
    if (!chosen.length) chosen = people.slice(0, 2);
    if (!chosen.length) continue;
    const { id: courseId } = insCourse.get(c.code, c.title, Number(c.program), c.sem.endsWith('W') ? 'HS' : 'FS', c.year ?? null, c.section || '', c.leId);
    nCourses++;
    for (const p of chosen) {
      if (!seenProf.has(p.id)) {
        insProf.run(Number(p.id), cleanName(p.fullName), p.fullName, p.relationship || '', p.department || '', p.field || '', p.url || '', p.image || null, p.imageSource || null);
        seenProf.add(p.id);
      }
      insCP.run(courseId, Number(p.id));
    }
  }
  db.exec('COMMIT');
  console.log(`seeded ${Object.keys(C.programs).length} programs, ${nCourses} courses, ${seenProf.size} professors`);
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
