import { describe, expect, it } from 'vitest';
import { GUESSES_PER_DAY, MIN_CROWD, MIN_GAP, pickQuestions } from '@/lib/guess';

describe('Tipp des Tages', () => {
  it('takes the crowd majority of a pair as the answer', () => {
    const [q] = pickQuestions([{ a: 1, b: 2, aWins: 1, n: MIN_CROWD }], [], new Set());
    expect(q.answer).toBe(2);
    expect([q.left, q.right].sort()).toEqual([1, 2]);
  });
  it('skips pairs with too few votes or a tie', () => {
    expect(pickQuestions([{ a: 1, b: 2, aWins: 1, n: MIN_CROWD - 1 }, { a: 3, b: 4, aWins: 2, n: 4 }], [], new Set())).toEqual([]);
  });
  it('falls back to the ladder within a department, with a real Elo gap', () => {
    const ranked = [{ id: 1, elo: 1300, department: 'D-INFK' }, { id: 2, elo: 1300 + MIN_GAP, department: 'D-INFK' }, { id: 3, elo: 1500, department: 'D-ARCH' }];
    const qs = pickQuestions([], ranked, new Set());
    expect(qs).toHaveLength(1);
    expect(qs[0].answer).toBe(2);
    expect(pickQuestions([], [ranked[0], { ...ranked[1], elo: 1301 }], new Set())).toEqual([]);
  });
  it('leaves out recent pairs, uses each professor once and stops at the daily count', () => {
    const h2h = Array.from({ length: 20 }, (_, i) => ({ a: 2 * i, b: 2 * i + 1, aWins: 3, n: 4 }));
    const qs = pickQuestions(h2h, [], new Set(['0-1']));
    expect(qs).toHaveLength(GUESSES_PER_DAY);
    const ids = qs.flatMap((q) => [q.left, q.right]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(0);
  });
});
