import { describe, expect, it } from 'vitest';
import { currentTerm, shiftTerm, startTermFor, termLabel, termOfSemester } from '@/lib/terms';

describe('terms', () => {
  it('knows which term runs on a date', () => {
    expect(currentTerm(new Date(2026, 9, 20))).toBe('2026W');
    expect(currentTerm(new Date(2027, 0, 10))).toBe('2026W');
    expect(currentTerm(new Date(2027, 1, 20))).toBe('2027S');
    expect(currentTerm(new Date(2027, 6, 31))).toBe('2027S');
    expect(currentTerm(new Date(2027, 7, 1))).toBe('2027W');
  });
  it('shifts across years', () => {
    expect(shiftTerm('2026W', 1)).toBe('2027S');
    expect(shiftTerm('2027S', -1)).toBe('2026W');
    expect(termLabel('2027S')).toBe('FS 2027');
  });
  it('finds the start term of a cohort', () => {
    expect(startTermFor(1, '2026W')).toBe('2026W');
    expect(startTermFor(3, '2026W')).toBe('2025W');
    // an even semester in autumn means the student was in it last spring
    expect(startTermFor(2, '2026W')).toBe('2025W');
    expect(termOfSemester('2025W', 3)).toBe('2026W');
  });
});
