import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH || path.join(dir, 'profclash.db');

export const START_ELO = 1200;
export const K = 32;

export function open() {
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY,
      dept_id INTEGER NOT NULL REFERENCES departments(id),
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS professors (
      id INTEGER PRIMARY KEY,           -- VVZ dozide
      name TEXT NOT NULL,               -- clean display name
      full_name TEXT NOT NULL,          -- incl. titles, as in VVZ
      relationship TEXT,
      department TEXT,
      field TEXT,
      url TEXT,
      image TEXT,
      image_source TEXT,
      elo REAL NOT NULL DEFAULT ${START_ELO},
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      program_id INTEGER NOT NULL REFERENCES programs(id),
      semester_type TEXT NOT NULL,      -- 'HS' (autumn) | 'FS' (spring)
      year INTEGER,                     -- study year 1..3 (null = unknown)
      section TEXT,
      vvz_id TEXT,
      UNIQUE (program_id, code)
    );
    CREATE TABLE IF NOT EXISTS course_professors (
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      prof_id INTEGER NOT NULL REFERENCES professors(id),
      PRIMARY KEY (course_id, prof_id)
    );
    -- department-wise rating: only votes cast by students of that department count
    CREATE TABLE IF NOT EXISTS dept_ratings (
      prof_id INTEGER NOT NULL REFERENCES professors(id),
      dept_id INTEGER NOT NULL REFERENCES departments(id),
      elo REAL NOT NULL DEFAULT ${START_ELO},
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (prof_id, dept_id)
    );
    CREATE TABLE IF NOT EXISTS voters (
      token TEXT PRIMARY KEY,
      program_id INTEGER NOT NULL REFERENCES programs(id),
      semester INTEGER NOT NULL,
      profs TEXT NOT NULL,              -- JSON array of prof ids this student had
      xp INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voter TEXT NOT NULL REFERENCES voters(token),
      dept_id INTEGER NOT NULL,
      winner INTEGER NOT NULL REFERENCES professors(id),
      loser INTEGER NOT NULL REFERENCES professors(id),
      pair TEXT NOT NULL,               -- "minId-maxId", one vote per pair per voter
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (voter, pair)
    );
    CREATE INDEX IF NOT EXISTS idx_cp_prof ON course_professors(prof_id);
    CREATE INDEX IF NOT EXISTS idx_courses_program ON courses(program_id);
  `);
  return db;
}

export function expected(a, b) {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/** Returns [newWinner, newLoser, delta] */
export function eloUpdate(winner, loser) {
  const delta = K * (1 - expected(winner, loser));
  return [winner + delta, loser - delta, delta];
}

/** Clash-of-Clans style leagues by trophy (Elo) count */
export const LEAGUES = [
  { min: 0, name: 'Bronze', key: 'bronze' },
  { min: 1100, name: 'Silver', key: 'silver' },
  { min: 1175, name: 'Gold', key: 'gold' },
  { min: 1250, name: 'Crystal', key: 'crystal' },
  { min: 1325, name: 'Master', key: 'master' },
  { min: 1400, name: 'Champion', key: 'champion' },
  { min: 1500, name: 'Legend', key: 'legend' },
];

export function league(elo) {
  let l = LEAGUES[0];
  for (const x of LEAGUES) if (elo >= x.min) l = x;
  return l.key;
}
