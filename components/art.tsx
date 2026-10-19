'use client';
// Clash-style game art: trophies, league shields, XP star, department crests, portraits.
import { useId, useState } from 'react';
import { LEAGUES, type LeagueKey } from '@/lib/game';

export function TrophyIcon({ size }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={size} height={size}>
      <path d="M6 3h12v3h3v2a5 5 0 0 1-5 5h-.3A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.3 13H8a5 5 0 0 1-5-5V6h3V3Zm-1 5a3 3 0 0 0 2 2.8V8H5Zm14 0h-2v2.8A3 3 0 0 0 19 8Z"
        fill="#ffd23f" stroke="#2a1a0b" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 5.5h2v5H9z" fill="#fff6b0" opacity=".8" />
    </svg>
  );
}

export const Trophies = ({ n }: { n: number }) => <span className="trophies"><TrophyIcon />{n}</span>;

const LEAGUE_STYLE: Record<LeagueKey, [string, string, string]> = {
  bronze: ['#f1b07a', '#b06a35', '#6b3a17'], silver: ['#f4f7fb', '#a9b3c4', '#5b6476'], gold: ['#fff09a', '#ffbf1f', '#a86d00'],
  crystal: ['#f6c9ff', '#b45ee0', '#5f1f86'], master: ['#d9dde6', '#5c6372', '#22252c'], champion: ['#ff9d8a', '#d8261b', '#6e0e08'],
  legend: ['#fff6b0', '#ffd23f', '#7a4f00'],
};

export function LeagueBadge({ league, className = 'league-badge', style }: { league: LeagueKey; className?: string; style?: React.CSSProperties }) {
  const id = useId();
  const [a, b, c] = LEAGUE_STYLE[league];
  const name = LEAGUES.find((l) => l.key === league)?.name;
  return (
    <svg className={className} style={style} viewBox="0 0 84 96" role="img" aria-label={`${name} league`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} /><stop offset=".6" stopColor={b} /><stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      {league === 'legend' && <path d="M8 22 0 6l20 8L42 0l22 14 20-8-8 16Z" fill="#ffd23f" stroke="#2a1a0b" strokeWidth="3" strokeLinejoin="round" />}
      <path d="M42 8 76 20v28c0 22-16 36-34 44C24 84 8 70 8 48V20Z" fill={`url(#${id})`} stroke="#2a1a0b" strokeWidth="4" strokeLinejoin="round" />
      <path d="M42 18 66 27v21c0 15-11 26-24 32-13-6-24-17-24-32V27Z" fill="rgba(255,255,255,.18)" />
      <path d="M30 40h24v6a12 12 0 0 1-24 0Z M26 40h4v6h-4a3 3 0 0 1 0-6Z M58 40h-4v6h4a3 3 0 0 0 0-6Z M38 58h8v6h5v4H33v-4h5Z"
        fill="#fff" stroke="#2a1a0b" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M16 22 42 12l26 10" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function XpStar({ level }: { level: number }) {
  return (
    <div className="xp-star" title={`Student level ${level}`}>
      <svg viewBox="0 0 50 50"><path d="M25 2l6.5 14.5L47 18l-11.5 10.5L39 45 25 37 11 45l3.5-16.5L3 18l15.5-1.5Z" fill="#2f95e6" stroke="#2a1a0b" strokeWidth="3.5" strokeLinejoin="round" /><path d="M25 8l4.6 10.3 10.9 1.1" fill="none" stroke="#bfe8ff" strokeWidth="3" strokeLinecap="round" /></svg>
      <span>{level}</span>
    </div>
  );
}

const hash = (s: string | number) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const CREST_COLORS = [['#2f95e6', '#135aa0'], ['#e8402a', '#9a1e10'], ['#4fbf20', '#2d7d0f'], ['#c13edc', '#6c1785'], ['#ffb40a', '#c97a00'], ['#14b8a6', '#0f766e'], ['#f97316', '#9a3412']];

const DEPT_ICON: Record<number, string> = { 1: '🏛️', 2: '🌉', 11: '🧬', 23: '🔬', 20: '⚗️', 13: '🌋', 17: '📜', 24: '❤️', 5: '💻', 18: '⚡', 7: '📈', 3: '⚙️', 19: '🧱', 8: '➗', 9: '⚛️', 25: '🌳' };

export function DeptCrest({ id, className = 'crest' }: { id: number; className?: string }) {
  const [a, b] = CREST_COLORS[hash(id * 7) % CREST_COLORS.length];
  return (
    <svg className={className} viewBox="0 0 58 66" aria-hidden="true">
      <path d="M29 3 54 12v20c0 16-11 26-25 31C15 58 4 48 4 32V12Z" fill={a} stroke="#2a1a0b" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M29 3 54 12v20c0 16-11 26-25 31Z" fill={b} opacity=".45" />
      <text x="29" y="41" textAnchor="middle" fontSize="24">{DEPT_ICON[id] || '🎓'}</text>
    </svg>
  );
}

/** Fallback portrait: a banner crest with the professor's initials */
function CrestAvatar({ id, name }: { id: number; name: string }) {
  const [a, b] = CREST_COLORS[hash(id) % CREST_COLORS.length];
  const w = name.split(/\s+/).filter(Boolean);
  const ini = ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={name}>
      <rect width="120" height="120" fill={a} />
      <path d="M-10 90 L130 30 V140 H-10Z" fill={b} opacity=".55" />
      <circle cx="60" cy="50" r="22" fill="#ffe0bd" stroke="#2a1a0b" strokeWidth="4" />
      <path d="M22 118c4-26 20-38 38-38s34 12 38 38" fill="#fff5d9" stroke="#2a1a0b" strokeWidth="4" />
      <text x="60" y="112" textAnchor="middle" fontFamily="var(--display)" fontSize="26" fill="#fff" stroke="#2a1a0b" strokeWidth="5" paintOrder="stroke">{ini}</text>
    </svg>
  );
}

export function Portrait({ p }: { p: { id: number; name: string; image: string | null } }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="portrait">
      {p.image && !broken
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/${p.image}`} alt={p.name} loading="lazy" draggable={false} onError={() => setBroken(true)} />
        : <CrestAvatar id={p.id} name={p.name} />}
    </div>
  );
}
