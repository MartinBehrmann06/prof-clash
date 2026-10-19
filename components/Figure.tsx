'use client';
// Procedural comic figures instead of photos. Every professor gets a fixed, family-friendly
// character derived from their id — it is deliberately NOT a likeness of the real person.
import { memo, useId } from 'react';
import { deptByName } from '@/lib/departments';

const INK = '#2a1a0b';
const SKIN = ['#ffdcbc', '#f6c89a', '#e8b07a', '#c98b5a', '#9a6440', '#6e4428'];
const HAIR = ['#2b1d14', '#4a3020', '#7a4a26', '#b9853f', '#e3c27a', '#8f8f94', '#c9c9cd', '#efefef', '#a8432a'];
type Hair = 'bald' | 'short' | 'side' | 'curly' | 'long' | 'bun' | 'spiky' | 'tuft';
const HAIRS: Hair[] = ['bald', 'short', 'side', 'curly', 'long', 'bun', 'spiky', 'tuft'];
type Hat = 'none' | 'cap' | 'hardhat' | 'beret' | 'goggles' | 'wizard';

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const pick = <T,>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length)];

function traits(id: number, dept: string) {
  const r = rng(id * 2654435761);
  const code = deptByName(dept).code;
  const hair = pick(r, HAIRS);
  const deptHat: Hat = ({ BAUG: 'hardhat', MAVT: 'hardhat', ITET: 'hardhat', ARCH: 'beret', CHAB: 'goggles', BIOL: 'goggles', MATH: 'wizard', PHYS: 'wizard' } as Record<string, Hat>)[code] ?? 'cap';
  const hatRoll = r();
  return {
    skin: pick(r, SKIN),
    hairColor: pick(r, HAIR),
    hair,
    glasses: r() < 0.45 ? pick(r, ['round', 'square'] as const) : null,
    facial: r() < 0.3 ? pick(r, ['beard', 'mustache', 'goatee'] as const) : null,
    brows: r() < 0.5 ? 'up' : 'flat',
    mouth: pick(r, ['smile', 'grin', 'open'] as const),
    hat: (hatRoll < 0.28 ? deptHat : hatRoll < 0.36 ? 'cap' : 'none') as Hat,
    tie: r() < 0.4,
    eyeShift: r() < 0.5 ? -1 : 1,
  };
}

/** A chibi bust in the department colour. `mood` animates the face after a vote. */
export const Figure = memo(function Figure({ id, name, department, mood = 'idle', className = '' }: {
  id: number; name: string; department: string; mood?: 'idle' | 'happy' | 'sad'; className?: string;
}) {
  const t = traits(id, department);
  const d = deptByName(department);
  const uid = useId().replace(/:/g, '');
  const outfit = d.color;
  const hairBack = t.hair === 'long' || t.hair === 'bun';
  return (
    <svg className={`figure ${className}`} viewBox="0 -18 200 238" role="img" aria-label={`Comicfigur für ${name}`}>
      <defs>
        <radialGradient id={`bg${uid}`} cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#fff7d6" /><stop offset="1" stopColor={outfit} stopOpacity=".35" />
        </radialGradient>
        <linearGradient id={`sh${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
      </defs>
      <rect y="-18" width="200" height="238" fill={`url(#bg${uid})`} />
      {/* sun rays */}
      <g opacity=".22">{Array.from({ length: 12 }, (_, i) => <path key={i} d="M100 95 L88 -20 L112 -20Z" fill="#fff" transform={`rotate(${i * 30} 100 95)`} />)}</g>

      {/* body */}
      <path d="M22 222 C24 170 54 150 100 150 C146 150 176 170 178 222Z" fill={outfit} stroke={INK} strokeWidth="5" />
      <path d="M22 222 C24 170 54 150 100 150 C146 150 176 170 178 222Z" fill={`url(#sh${uid})`} />
      <path d="M78 152 L100 182 L122 152" fill="#fff" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      {t.tie && <path d="M100 172 L92 186 L100 214 L108 186Z" fill="#e8402a" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />}
      <rect x="128" y="186" width="34" height="18" rx="5" fill="#fff" stroke={INK} strokeWidth="3" />
      <text x="145" y="199" textAnchor="middle" fontSize="10" fontWeight="900" fill={INK} fontFamily="system-ui, sans-serif">{d.code}</text>
      {/* neck */}
      <rect x="86" y="128" width="28" height="30" rx="10" fill={t.skin} stroke={INK} strokeWidth="4.5" />

      {/* hair behind head */}
      {hairBack && <path d="M44 92 C40 150 60 168 100 168 C140 168 160 150 156 92Z" fill={t.hairColor} stroke={INK} strokeWidth="5" />}
      {t.hair === 'bun' && <circle cx="100" cy="30" r="20" fill={t.hairColor} stroke={INK} strokeWidth="5" />}

      {/* head */}
      <circle cx="48" cy="98" r="13" fill={t.skin} stroke={INK} strokeWidth="4.5" />
      <circle cx="152" cy="98" r="13" fill={t.skin} stroke={INK} strokeWidth="4.5" />
      <ellipse cx="100" cy="92" rx="54" ry="58" fill={t.skin} stroke={INK} strokeWidth="5" />
      <ellipse cx="82" cy="70" rx="18" ry="10" fill="#fff" opacity=".28" />

      <HairFront style={t.hair} color={t.hairColor} />

      {/* face */}
      <g className={`face mood-${mood}`}>
        {t.brows === 'up'
          ? <><path d="M68 74 Q78 66 88 72" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" /><path d="M112 72 Q122 66 132 74" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" /></>
          : <><path d="M68 72 L88 72" stroke={INK} strokeWidth="5" strokeLinecap="round" /><path d="M112 72 L132 72" stroke={INK} strokeWidth="5" strokeLinecap="round" /></>}
        {mood === 'happy' ? (
          <><path d="M68 92 Q78 82 88 92" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" /><path d="M112 92 Q122 82 132 92" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" /></>
        ) : (
          <>
            <ellipse cx="78" cy="92" rx="9" ry="11" fill="#fff" stroke={INK} strokeWidth="3.5" />
            <ellipse cx="122" cy="92" rx="9" ry="11" fill="#fff" stroke={INK} strokeWidth="3.5" />
            <circle cx={78 + t.eyeShift * 2} cy={mood === 'sad' ? 96 : 93} r="4.5" fill={INK} />
            <circle cx={122 + t.eyeShift * 2} cy={mood === 'sad' ? 96 : 93} r="4.5" fill={INK} />
            <circle cx={79 + t.eyeShift * 2} cy="91" r="1.5" fill="#fff" />
            <circle cx={123 + t.eyeShift * 2} cy="91" r="1.5" fill="#fff" />
          </>
        )}
        <ellipse cx="64" cy="112" rx="8" ry="5" fill="#ff8a8a" opacity=".45" />
        <ellipse cx="136" cy="112" rx="8" ry="5" fill="#ff8a8a" opacity=".45" />
        <path d="M97 100 Q100 108 104 104" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        {mood === 'sad'
          ? <path d="M86 128 Q100 118 114 128" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          : t.mouth === 'open' || mood === 'happy'
            ? <path d="M84 118 Q100 140 116 118Z" fill="#7a2a1a" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
            : t.mouth === 'grin'
              ? <><path d="M82 118 Q100 134 118 118Z" fill="#fff" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" /><path d="M86 121 L114 121" stroke={INK} strokeWidth="2" /></>
              : <path d="M84 120 Q100 132 116 120" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />}
      </g>

      {t.facial === 'beard' && <path d="M50 104 C52 150 76 160 100 160 C124 160 148 150 150 104 C140 128 124 132 100 132 C76 132 60 128 50 104Z" fill={t.hairColor} stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />}
      {t.facial === 'mustache' && <path d="M80 114 Q90 106 100 112 Q110 106 120 114 Q110 118 100 115 Q90 118 80 114Z" fill={t.hairColor} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />}
      {t.facial === 'goatee' && <path d="M90 134 Q100 152 110 134 Q100 140 90 134Z" fill={t.hairColor} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />}

      {t.glasses === 'round' && <g fill="rgba(200,230,255,.25)" stroke={INK} strokeWidth="4"><circle cx="78" cy="92" r="15" /><circle cx="122" cy="92" r="15" /><path d="M93 92 L107 92" /></g>}
      {t.glasses === 'square' && <g fill="rgba(200,230,255,.25)" stroke={INK} strokeWidth="4"><rect x="62" y="80" width="32" height="24" rx="6" /><rect x="106" y="80" width="32" height="24" rx="6" /><path d="M94 90 L106 90" /></g>}

      <HatShape hat={t.hat} color={outfit} />
    </svg>
  );
});

function HairFront({ style, color }: { style: Hair; color: string }) {
  const p = { fill: color, stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' as const };
  switch (style) {
    case 'bald': return <path d="M58 78 C52 66 56 54 64 50" fill="none" stroke={INK} strokeWidth="0" />;
    case 'tuft': return <><path d="M50 84 C44 66 52 52 62 50 C58 62 60 72 64 80Z" {...p} /><path d="M150 84 C156 66 148 52 138 50 C142 62 140 72 136 80Z" {...p} /></>;
    case 'short': return <path d="M46 84 C42 46 70 30 100 30 C130 30 158 46 154 84 C146 66 132 58 112 60 C96 50 74 54 62 64 C54 70 50 76 46 84Z" {...p} />;
    case 'side': return <path d="M46 88 C40 44 72 28 104 30 C136 32 160 50 154 86 C150 70 140 58 124 54 C110 66 84 70 60 66 C52 72 48 80 46 88Z" {...p} />;
    case 'curly': return <g {...p}>{[[54, 66], [64, 46], [84, 34], [104, 30], [124, 36], [142, 48], [150, 68], [72, 56], [96, 46], [118, 50]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="15" />)}</g>;
    case 'long': return <path d="M44 100 C38 46 70 30 100 30 C130 30 162 46 156 100 C150 76 138 62 120 58 C104 66 80 64 66 60 C54 70 48 84 44 100Z" {...p} />;
    case 'bun': return <path d="M46 86 C42 50 70 34 100 34 C130 34 158 50 154 86 C144 64 124 56 100 56 C76 56 56 64 46 86Z" {...p} />;
    case 'spiky': return <path d="M46 86 L44 54 L62 62 L66 30 L84 50 L100 22 L116 50 L134 30 L138 62 L156 54 L154 86 C140 64 120 58 100 58 C80 58 60 64 46 86Z" {...p} />;
  }
}

function HatShape({ hat, color }: { hat: Hat; color: string }) {
  const o = { stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' as const };
  switch (hat) {
    case 'cap': return <g><path d="M40 46 L100 22 L160 46 L100 70Z" fill="#2b2d3a" {...o} /><path d="M70 58 L70 74 C86 84 114 84 130 74 L130 58" fill="#2b2d3a" {...o} /><path d="M150 50 L154 82" stroke="#ffcf3e" strokeWidth="4" /><circle cx="154" cy="86" r="5" fill="#ffcf3e" stroke={INK} strokeWidth="3" /></g>;
    case 'hardhat': return <g><path d="M44 74 C44 30 156 30 156 74Z" fill="#ffcf3e" {...o} /><path d="M34 76 L166 76" stroke={INK} strokeWidth="9" strokeLinecap="round" /><path d="M34 76 L166 76" stroke="#ffcf3e" strokeWidth="4" strokeLinecap="round" /><path d="M100 34 L100 70" stroke="#e5a800" strokeWidth="6" /></g>;
    case 'beret': return <g><path d="M46 62 C40 30 150 22 160 54 C150 66 60 72 46 62Z" fill={color} {...o} /><circle cx="104" cy="28" r="5" fill={color} {...o} strokeWidth={3} /></g>;
    case 'goggles': return <g><path d="M48 50 Q100 38 152 50" fill="none" stroke={INK} strokeWidth="10" /><path d="M48 50 Q100 38 152 50" fill="none" stroke="#3d8bff" strokeWidth="5" /><rect x="66" y="30" width="30" height="24" rx="10" fill="#b8ecff" {...o} strokeWidth={4} /><rect x="104" y="30" width="30" height="24" rx="10" fill="#b8ecff" {...o} strokeWidth={4} /><path d="M72 36 L80 36" stroke="#fff" strokeWidth="3" strokeLinecap="round" /><path d="M110 36 L118 36" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></g>;
    case 'wizard': return <g><path d="M56 66 L100 -6 L144 66Z" fill="#6c3bd1" {...o} /><path d="M40 66 C70 80 130 80 160 66" fill="none" {...o} strokeWidth={9} stroke={INK} /><path d="M40 66 C70 80 130 80 160 66" fill="none" stroke="#6c3bd1" strokeWidth="4" /><path d="M96 30 l4 -8 l4 8 l8 1 l-6 6 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -6Z" fill="#ffcf3e" /></g>;
    default: return null;
  }
}
