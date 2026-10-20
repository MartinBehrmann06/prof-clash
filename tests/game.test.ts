import { describe, expect, it } from 'vitest';
import { eloUpdate, expected, isEthEmail, ethUser, K, league, levelFor, levelProgress } from '@/lib/game';

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

describe('leagues and levels', () => {
  it('maps trophies to leagues at the thresholds', () => {
    expect(league(1099)).toBe('bronze');
    expect(league(1100)).toBe('silver');
    expect(league(1200)).toBe('gold');
    expect(league(1500)).toBe('legend');
  });
  it('levels up at 20·L² XP', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(19)).toBe(1);
    expect(levelFor(20)).toBe(2);
    expect(levelFor(80)).toBe(3);
    expect(levelProgress(50)).toBeCloseTo(0.5);
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
