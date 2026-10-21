import { describe, expect, it } from 'vitest';
import { eloUpdate, expected, isEthEmail, ethUser, K, league, ROUND_SIZE, roundOf } from '@/lib/game';

describe('Elo', () => {
  it('moves equal ratings by K/2', () => {
    const [w, l, d] = eloUpdate(1200, 1200);
    expect(d).toBe(K / 2);
    expect(w).toBe(1216);
    expect(l).toBe(1184);
  });
  it('keeps the total constant', () => {
    const [w, l] = eloUpdate(1310, 1170);
    expect(w + l).toBeCloseTo(1310 + 1170);
  });
  it('gives an upset more than a favourite win', () => {
    expect(eloUpdate(1100, 1400)[2]).toBeGreaterThan(eloUpdate(1400, 1100)[2]);
  });
  it('has symmetric expectations', () => {
    expect(expected(1300, 1200) + expected(1200, 1300)).toBeCloseTo(1);
  });
});

describe('leagues', () => {
  it('maps trophies to leagues at the thresholds', () => {
    expect(league(1099)).toBe('bronze');
    expect(league(1100)).toBe('silver');
    expect(league(1200)).toBe('gold');
    expect(league(1500)).toBe('legend');
  });
});

describe('ETH logins', () => {
  it('accepts only ETH addresses', () => {
    expect(isEthEmail('a@ethz.ch')).toBe(true);
    expect(isEthEmail('a@student.ethz.ch')).toBe(true);
    expect(isEthEmail('a@gmail.com')).toBe(false);
    expect(isEthEmail('a@ethz.ch.evil.com')).toBe(false);
  });
  it('treats both ETH domains as one user', () => {
    expect(ethUser('Max@ethz.ch')).toBe(ethUser('max@student.ethz.ch'));
  });
  it('treats plus addresses as the same user', () => {
    expect(ethUser('max+2@student.ethz.ch')).toBe('max');
  });
});

describe('rounds', () => {
  it('counts duels within a round of ROUND_SIZE', () => {
    expect(roundOf(7, 120, 0)).toEqual({ number: 1, size: ROUND_SIZE, done: 7, over: false });
    expect(roundOf(20, 120, 0).over).toBe(true);
    expect(roundOf(23, 120, 20)).toMatchObject({ number: 2, done: 3 });
  });
  it('shortens the last round to the pairs that are left', () => {
    expect(roundOf(110, 120, 100)).toMatchObject({ number: 6, size: 20, done: 10 });
    expect(roundOf(118, 120, 110)).toMatchObject({ size: 10, done: 8, over: false });
    expect(roundOf(120, 120, 110).over).toBe(true);
  });
  it('is empty when nothing is left to judge', () => {
    expect(roundOf(45, 45, 45)).toMatchObject({ size: 0, over: false });
  });
});
