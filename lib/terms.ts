// ETH terms as VVZ "semkez": '2026W' = autumn (HS) 2026, '2026S' = spring (FS) 2026.
// A student who is in semester N now took semester k exactly N-k terms ago,
// so their professors for semester k come from that term's VVZ.

export type Term = string;

const toIndex = (t: Term) => Number(t.slice(0, 4)) * 2 + (t.endsWith('W') ? 1 : 0);
const fromIndex = (i: number): Term => `${Math.floor(i / 2)}${i % 2 ? 'W' : 'S'}`;

/** Term running on a given date: Aug–Jan = autumn, Feb–Jul = spring */
export function currentTerm(now = new Date()): Term {
  const m = now.getMonth(), y = now.getFullYear();
  if (m >= 7) return `${y}W`;
  if (m === 0) return `${y - 1}W`;
  return `${y}S`;
}

export const isAutumn = (t: Term) => t.endsWith('W');
export const shiftTerm = (t: Term, by: number) => fromIndex(toIndex(t) + by);
export const termLabel = (t: Term) => `${isAutumn(t) ? 'HS' : 'FS'} ${t.slice(0, 4)}`;

/**
 * Term in which a student now in `semester` started semester 1.
 * Odd semesters run in autumn; if the parity doesn't match the running term,
 * the student's semester `semester` was the previous term.
 */
export function startTermFor(semester: number, now: Term = currentTerm()): Term {
  const semesterTerm = (semester % 2 === 1) === isAutumn(now) ? now : shiftTerm(now, -1);
  return shiftTerm(semesterTerm, -(semester - 1));
}

/** Term in which semester k happened for a student who started in `start` */
export const termOfSemester = (start: Term, k: number) => shiftTerm(start, k - 1);
