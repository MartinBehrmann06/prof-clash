'use client';
// Game art: icons, trophies, league shields, level star, logo mark.
// Flat fills with one shaded facet; the ink outline comes from CSS so edges stay clean.
import { useId } from 'react';
import { LEAGUES, type LeagueKey } from '@/lib/game';

const ICONS = {
  swords: <><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="m13 19 6-6" /><path d="m16 16 4 4" /><path d="m19 21 2-2" /><path d="M14.5 6.5 18 3h3v3l-3.5 3.5" /><path d="m5 14 4 4" /><path d="m7 17-3 3" /><path d="m3 19 2 2" /></>,
  shield: <path d="M12 21.5s7.5-3.6 7.5-9.5V5.2L12 2.5 4.5 5.2V12c0 5.9 7.5 9.5 7.5 9.5Z" />,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.9M17 6h2.5a2.5 2.5 0 0 1-2.6 3.9" /><path d="M12 14v4M8 21h8M9.5 18h5" /></>,
  play: <path d="M7.5 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8a1 1 0 0 0-1.5.86Z" fill="currentColor" />,
  left: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  right: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z" /></>,
  power: <><path d="M12 3v8" /><path d="M6.3 6.8a8 8 0 1 0 11.4 0" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  // drawn with its own ink edge: the outline filter other button icons use fills the gaps of a thin X into a dark square
  close: <><path d="M7 7l10 10M17 7 7 17" stroke="#1e1712" strokeWidth="6.4" /><path d="M7 7l10 10M17 7 7 17" strokeWidth="3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  skip: <><path d="M5 5.5v13l9-6.5-9-6.5Z" /><path d="M18 5v14" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></>,
  crown: <path d="M3.5 8 8 12l4-6.5 4 6.5 4.5-4-1.8 10.5H5.3L3.5 8Z" />,
  book: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /></>,
  cap: <><path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c3.5 2.4 8.5 2.4 12 0v-5" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".8" fill="currentColor" /></>,
  share: <><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>,
  key: <><circle cx="8" cy="15" r="4.5" /><path d="m11.2 11.8 8.3-8.3M17 6l2.5 2.5M14.5 8.5 16.5 10.5" /></>,
} as const;
export type IconName = keyof typeof ICONS;

/** Line icon in the current text colour */
export function Icon({ name, size = 18, className = 'icon' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>
  );
}

/** Brand mark: a red clan shield with crossed swords */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 44" width={size} height={size * 1.1} aria-hidden="true" className="logo-mark">
      <path d="M20 1C27 1 33 3 38 5.5V21C38 32 29 39 20 43C11 39 2 32 2 21V5.5C7 3 13 1 20 1Z" fill="#ff7a5e" />
      <path d="M20 1C27 1 33 3 38 5.5V21C38 32 29 39 20 43Z" fill="#e0412b" />
      <g stroke="#1e1712" strokeWidth="5.5" strokeLinecap="round"><path d="M12 13 28 29M28 13 12 29" /></g>
      <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M12 13 28 29M28 13 12 29" /></g>
      <g fill="#ffc21a" stroke="#1e1712" strokeWidth="1.6"><circle cx="13" cy="28" r="2.6" /><circle cx="27" cy="28" r="2.6" /></g>
    </svg>
  );
}

export function TrophyIcon({ size }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={size} height={size} className="trophy-icon">
      <path d="M5.5 5.5H3.8a.8.8 0 0 0-.8.9c.3 2.6 1.8 4.4 4 4.9M18.5 5.5h1.7a.8.8 0 0 1 .8.9c-.3 2.6-1.8 4.4-4 4.9" fill="none" stroke="#f0a91c" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 3h12v6a6 6 0 0 1-12 0V3Z" fill="#ffc53d" />
      <path d="M12 3h6v6a6 6 0 0 1-6 6V3Z" fill="#f0a91c" />
      <path d="M10.5 14.5h3V18h-3Z" fill="#f0a91c" />
      <rect x="7" y="18" width="10" height="3.5" rx="1.2" fill="#ffc53d" />
    </svg>
  );
}

export const Trophies = ({ n }: { n: number }) => <span className="trophies"><TrophyIcon /><span className="num">{n}</span></span>;

const LEAGUE_STYLE: Record<LeagueKey, [string, string]> = {
  bronze: ['#e09a63', '#c27a43'], silver: ['#c9d1de', '#a4afc1'], gold: ['#ffc53d', '#f0a21c'],
  crystal: ['#c084fc', '#9b5cf0'], master: ['#5d6273', '#454959'], champion: ['#ff5a4a', '#dd3d2e'],
  legend: ['#ffc53d', '#f0a21c'],
};

export function LeagueBadge({ league, className = 'league-badge', style }: { league: LeagueKey; className?: string; style?: React.CSSProperties }) {
  const [a, b] = LEAGUE_STYLE[league];
  const name = LEAGUES.find((l) => l.key === league)?.name;
  const shield = 'M42 6 75 17v28c0 24-17 38-33 46C26 83 9 69 9 45V17Z';
  return (
    <svg className={className} style={style} viewBox="0 0 84 96" role="img" aria-label={`${name} league`}>
      {league === 'legend' && <path d="M14 22 8 6l15 7 19-11 19 11 15-7-6 16Z" fill="#ffc53d" />}
      <path d={shield} fill={league === 'legend' ? '#2b2a3a' : a} />
      <path d="M42 6 75 17v28c0 24-17 38-33 46Z" fill={league === 'legend' ? '#1d1c28' : b} />
      <path d="M42 30l4.4 9 9.9 1.4-7.2 7 1.7 9.8-8.8-4.6-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4Z" fill={league === 'legend' ? '#ffc53d' : '#fff'} />
    </svg>
  );
}

export function XpStar({ level }: { level: number }) {
  return (
    <div className="xp-star" title={`Level ${level}`}>
      <svg viewBox="0 0 50 50" aria-hidden="true">
        <path d="M25 3.5c1.2 0 2.2.7 2.7 1.8l4.6 9.6 10.4 1.4c2.4.4 3.4 3.3 1.6 5L36.7 28.7l1.9 10.4c.4 2.4-2.1 4.2-4.3 3.1L25 37.2l-9.3 5c-2.2 1.1-4.7-.7-4.3-3.1l1.9-10.4-7.6-7.4c-1.8-1.7-.8-4.6 1.6-5l10.4-1.4 4.6-9.6c.5-1.1 1.5-1.8 2.7-1.8Z" fill="var(--blue)" />
      </svg>
      <span>{level}</span>
    </div>
  );
}
