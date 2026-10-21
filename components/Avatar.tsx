'use client';
import { Figure } from './Figure';

/** Same seed for the same ETH username on every device; far outside the VVZ id range of real professors */
export const avatarSeed = (username: string) => 2_000_000_000 + ([...username].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 100_000_000);

/** The player's own drawn figure, in their department's colour, cut to a round badge */
export function Avatar({ username, department, size = 40, className = '' }: { username: string; department?: string; size?: number; className?: string }) {
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size }}>
      <Figure id={avatarSeed(username)} name={username} department={department ?? ''} mood="happy" />
    </span>
  );
}
