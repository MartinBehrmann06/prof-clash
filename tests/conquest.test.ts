import { describe, expect, it } from 'vitest';
import { clock, DEFENSE_BONUS, homeOf, NEUTRAL_GARRISON, ranking, replay, SEASON_WEEKS } from '@/lib/conquest';

const CAB_DEPT = homeOf(5)!.home!; // a home base: never attackable

describe('Weekend League battles', () => {
  it('takes a neutral building only with more troops than its garrison', () => {
    expect(replay(0, 1, [{ week: 0, code: 'LEE', dept: 5, troops: NEUTRAL_GARRISON }]).owners.get('LEE')).toBeNull();
    expect(replay(0, 1, [{ week: 0, code: 'LEE', dept: 5, troops: NEUTRAL_GARRISON + 1 }]).owners.get('LEE')).toBe(5);
  });
  it('gives defenders a bonus', () => {
    const forces = [
      { week: 0, code: 'LEE', dept: 5, troops: 20 },
      { week: 1, code: 'LEE', dept: 5, troops: 10 },
      { week: 1, code: 'LEE', dept: 8, troops: 10 * DEFENSE_BONUS },
    ];
    expect(replay(0, 2, forces).owners.get('LEE')).toBe(5);
    forces[2].troops += 1;
    expect(replay(0, 2, forces).owners.get('LEE')).toBe(8);
  });
  it('leaves a tie between attackers undecided', () => {
    const r = replay(0, 1, [{ week: 0, code: 'LEE', dept: 5, troops: 30 }, { week: 0, code: 'LEE', dept: 8, troops: 30 }]);
    expect(r.owners.get('LEE')).toBeNull();
  });
  it('ignores attacks on home bases', () => {
    expect(replay(0, 1, [{ week: 0, code: 'CAB', dept: 8, troops: 999 }]).owners.get('CAB')).toBe(CAB_DEPT);
  });
  it('ranks by buildings, then troops sent', () => {
    const r = replay(0, 1, [{ week: 0, code: 'LEE', dept: 5, troops: 40 }]);
    const top = ranking(r.owners, r.sent)[0];
    expect(top.dept).toBe(5);
    expect(top.buildings).toBe(2);
  });
});

describe('league clock', () => {
  it('counts weeks from the league start in Zurich time', () => {
    expect(clock(new Date('2026-10-19T00:30:00+02:00')).week).toBe(0);
    expect(clock(new Date('2026-10-25T23:30:00+01:00')).week).toBe(0);
    expect(clock(new Date('2026-10-26T00:30:00+01:00')).week).toBe(1);
    const c = clock(new Date(Date.UTC(2026, 9, 19) + SEASON_WEEKS * 7 * 86_400_000 + 3_600_000));
    expect(c).toMatchObject({ season: 2, round: 1 });
  });
});
