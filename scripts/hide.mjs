// Removal requests: hide a professor everywhere (rankings, rosters, matchups, profile page).
//   node scripts/hide.mjs <id | name>          hide
//   node scripts/hide.mjs <id | name> --undo   show again
//   node scripts/hide.mjs --list               list hidden professors
// Their past votes stay in the database but no longer show up anywhere.
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const args = process.argv.slice(2);
const undo = args.includes('--undo');
const who = args.filter((a) => !a.startsWith('--')).join(' ').trim();

try {
  await pool.query('ALTER TABLE professors ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false');
  if (args.includes('--list') || !who) {
    const { rows } = await pool.query('SELECT id, name, department FROM professors WHERE hidden ORDER BY name');
    console.log(rows.length ? rows.map((r) => `${r.id}  ${r.name}  (${r.department})`).join('\n') : 'no hidden professors');
  } else {
    const { rows } = /^\d+$/.test(who)
      ? await pool.query('SELECT id, name FROM professors WHERE id = $1', [Number(who)])
      : await pool.query('SELECT id, name FROM professors WHERE name ILIKE $1 OR full_name ILIKE $1', [`%${who}%`]);
    if (rows.length !== 1) {
      console.log(rows.length ? `ambiguous, use the id:\n${rows.map((r) => `${r.id}  ${r.name}`).join('\n')}` : 'not found');
      process.exitCode = 1;
    } else {
      await pool.query('UPDATE professors SET hidden = $1 WHERE id = $2', [!undo, rows[0].id]);
      // drop any matchup currently served with them
      if (!undo) await pool.query("UPDATE profiles SET pending_pair = NULL WHERE pending_pair ~ ('(^|-)' || $1 || '(-|$)')", [String(rows[0].id)]);
      console.log(`${undo ? 'visible again' : 'hidden'}: ${rows[0].name} (${rows[0].id})`);
    }
  }
} finally {
  await pool.end();
}
