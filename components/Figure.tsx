'use client';
// Procedural professor portraits instead of photos. Every professor gets a fixed, family-friendly
// character derived from their id — it is deliberately NOT a likeness of the real person.
// Flat vector style: no outlines, every shape is either fully inside another or clipped to it,
// so nothing overlaps raggedly at any size.
import { memo, useId } from 'react';
import { deptByName } from '@/lib/departments';

const INK = '#23212e';
const SKIN = ['#ffe0c7', '#f6cba6', '#e6ab80', '#c98a5c', '#9d6743', '#6e472f'];
const HAIR = ['#2a221f', '#4a3428', '#7a4b2c', '#b5833f', '#e3c483', '#8e8b93', '#c8c5cc', '#eceaee', '#a9472f'];
type Hair = 'bald' | 'short' | 'side' | 'curly' | 'long' | 'bun' | 'quiff' | 'tuft';
const HAIRS: Hair[] = ['bald', 'short', 'side', 'curly', 'long', 'bun', 'quiff', 'tuft'];
type Hat = 'none' | 'cap' | 'hardhat' | 'beret' | 'goggles' | 'wizard';

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const pick = <T,>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length)];

/** mix two #rrggbb colours, t = share of b */
export function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

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

// head and hair geometry (viewBox 200 × 238)
const HEAD = { cx: 100, cy: 112, rx: 44, ry: 50 };
const CAP = { cx: 100, cy: 105, rx: 49, ry: 57 };
const EYE_Y = 113;

/** Where the hair cap is visible, per style (the cap ellipse is clipped to this) */
const HAIRLINE: Record<Hair, string> = {
  short: 'M0 0H200V110H149C147 92 138 81 122 77C108 82 90 84 74 80C63 86 56 96 51 110H0Z',
  side: 'M0 0H200V108H149C146 90 136 79 118 73C106 86 82 92 60 91C56 97 53 102 51 108H0Z',
  long: 'M0 0H200V140H146C144 100 128 84 100 77C72 84 56 100 54 140H0Z',
  bun: 'M0 0H200V106H148C142 88 124 78 100 76C76 78 58 88 52 106H0Z',
  curly: 'M0 0H200V112H149C147 96 140 86 130 82C122 88 112 84 106 80C98 86 88 86 82 81C72 86 62 90 56 98L51 112H0Z',
  quiff: 'M0 0H200V108H149C147 92 138 82 124 78C110 82 92 84 76 82C64 88 56 96 51 108H0Z',
  bald: 'M40 92Q58 84 66 102Q66 114 58 124H40ZM160 92Q142 84 134 102Q134 114 142 124H160Z',
  tuft: 'M40 92Q58 84 66 102Q66 114 58 124H40ZM160 92Q142 84 134 102Q134 114 142 124H160Z',
};

/** A friendly flat bust in the department colour. `mood` changes the face after a vote. */
export const Figure = memo(function Figure({ id, name, department, mood = 'idle', className = '' }: {
  id: number; name: string; department: string; mood?: 'idle' | 'happy' | 'sad'; className?: string;
}) {
  const t = traits(id, department);
  const d = deptByName(department);
  const uid = useId().replace(/:/g, '');
  const skinShade = mix(t.skin, '#6b2f1f', 0.16);
  const hairShade = mix(t.hairColor, '#000000', 0.18);
  const brow = mix(t.hairColor, INK, 0.45);
  const jacket = d.color, jacketShade = mix(d.color, '#000000', 0.16);
  const showEars = t.hair !== 'long';
  const hairBack = t.hair === 'long';
  const c = (s: string) => `${s}${uid}`;

  return (
    <svg className={`figure ${className}`} viewBox="0 0 200 238" role="img" aria-label={`Gezeichnete Figur für ${name}`}>
      <defs>
        <linearGradient id={c('bg')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(d.color, '#ffffff', 0.82)} /><stop offset="1" stopColor={mix(d.color, '#ffffff', 0.62)} />
        </linearGradient>
        <clipPath id={c('hl')}><path d={HAIRLINE[t.hair]} /></clipPath>
        <clipPath id={c('head')}><ellipse {...HEAD} /></clipPath>
        <clipPath id={c('body')}><path d="M18 238C18 198 50 178 100 178C150 178 182 198 182 238Z" /></clipPath>
      </defs>

      <rect width="200" height="238" fill={`url(#${c('bg')})`} />
      <circle cx="100" cy="118" r="80" fill="#ffffff" opacity=".35" />

      {/* long hair falls behind the head and over the shoulders */}
      {hairBack && <path d="M51 104C51 70 72 48 100 48C128 48 149 70 149 104V186C149 194 142 200 134 200H66C58 200 51 194 51 186Z" fill={hairShade} />}

      {/* body: jacket, shirt, optional tie */}
      <path d="M18 238C18 198 50 178 100 178C150 178 182 198 182 238Z" fill={jacket} />
      <g clipPath={`url(#${c('body')})`}>
        <path d="M100 178L74 182L100 228L126 182Z" fill="#ffffff" />
        {t.tie && <path d="M95 192H105L109 230L100 238L91 230Z" fill={INK} opacity=".85" />}
        <path d="M74 181L100 214L95 221L66 186Z" fill={jacketShade} />
        <path d="M126 181L100 214L105 221L134 186Z" fill={jacketShade} />
      </g>
      <path d="M86 150H114V174C114 182 108 188 100 188C92 188 86 182 86 174Z" fill={skinShade} />

      {hairBack && <path d="M51 104C51 70 72 48 100 48C128 48 149 70 149 104V150C140 160 128 164 118 162V120H82V162C72 164 60 160 51 150Z" fill={t.hairColor} />}
      {t.hair === 'bun' && <circle cx="100" cy="46" r="19" fill={t.hairColor} />}
      {t.hair === 'curly' && <g fill={t.hairColor}>{[-168, -146, -124, -102, -80, -58, -36, -14].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return <circle key={deg} cx={CAP.cx + Math.cos(a) * (CAP.rx - 6)} cy={CAP.cy + Math.sin(a) * (CAP.ry - 6)} r="15" />;
      })}</g>}

      {/* ears, head */}
      {showEars && <g>
        <circle cx="57" cy="117" r="10" fill={t.skin} /><circle cx="58" cy="117" r="5" fill={skinShade} />
        <circle cx="143" cy="117" r="10" fill={t.skin} /><circle cx="142" cy="117" r="5" fill={skinShade} />
      </g>}
      <ellipse {...HEAD} fill={t.skin} />
      {/* soft jaw shade, clipped to the face */}
      <ellipse cx="100" cy="176" rx="50" ry="26" fill={skinShade} opacity=".35" clipPath={`url(#${c('head')})`} />

      {/* face */}
      <g className={`face mood-${mood}`}>
        <circle cx="72" cy="131" r="7" fill="#ff7b7b" opacity=".28" />
        <circle cx="128" cy="131" r="7" fill="#ff7b7b" opacity=".28" />
        <g stroke={brow} strokeWidth="4" strokeLinecap="round" fill="none">
          {mood === 'sad'
            ? <><path d="M75 100L89 97" /><path d="M111 97L125 100" /></>
            : t.brows === 'up'
              ? <><path d="M75 99Q82 93 89 97" /><path d="M111 97Q118 93 125 99" /></>
              : <><path d="M75 98H89" /><path d="M111 98H125" /></>}
        </g>
        {mood === 'happy' ? (
          <g stroke={INK} strokeWidth="3.6" strokeLinecap="round" fill="none"><path d="M76 115Q82 108 88 115" /><path d="M112 115Q118 108 124 115" /></g>
        ) : (
          <g>
            <ellipse cx={82 + t.eyeShift} cy={mood === 'sad' ? EYE_Y + 2 : EYE_Y} rx="4.6" ry="5.6" fill={INK} />
            <ellipse cx={118 + t.eyeShift} cy={mood === 'sad' ? EYE_Y + 2 : EYE_Y} rx="4.6" ry="5.6" fill={INK} />
            <circle cx={83.6 + t.eyeShift} cy={EYE_Y - 2} r="1.6" fill="#fff" />
            <circle cx={119.6 + t.eyeShift} cy={EYE_Y - 2} r="1.6" fill="#fff" />
          </g>
        )}
        <path d="M96 124Q100 129 104 124" stroke={skinShade} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      </g>

      {t.facial === 'beard' && <path d="M56 114C57 152 76 170 100 170C124 170 143 152 144 114C139 128 128 134 116 134C110 132 105 131 100 131C95 131 90 132 84 134C72 134 61 128 56 114Z" fill={t.hairColor} />}
      {t.facial === 'goatee' && <path d="M91 149C93 160 107 160 109 149C105 152 95 152 91 149Z" fill={t.hairColor} />}

      <Mouth mood={mood} style={t.mouth} uid={uid} />
      {(t.facial === 'mustache' || t.facial === 'beard') && <path d="M83 135C88 129 96 129 100 133C104 129 112 129 117 135C111 138 105 138 100 137C95 138 89 138 83 135Z" fill={t.facial === 'beard' ? hairShade : t.hairColor} />}

      {/* hair cap: one ellipse, clipped to the style's hairline */}
      <ellipse {...CAP} fill={t.hairColor} clipPath={`url(#${c('hl')})`} />
      {t.hair === 'quiff' && <path d="M66 82C60 52 86 38 112 42C132 45 146 58 146 76C136 64 120 60 104 66C90 70 76 74 66 82Z" fill={t.hairColor} />}
      {t.hair === 'tuft' && <path d="M92 64C90 54 96 46 106 46C102 52 104 58 110 62C104 66 96 67 92 64Z" fill={t.hairColor} />}
      {t.hair === 'side' && <path d="M118 73C108 86 84 92 62 91C80 86 100 80 112 70Z" fill={hairShade} opacity=".5" />}

      {t.glasses === 'round' && <g fill="#ffffff" fillOpacity=".18" stroke={INK} strokeWidth="3"><circle cx="82" cy="113" r="12.5" /><circle cx="118" cy="113" r="12.5" /><path d="M94.5 112Q100 108 105.5 112" fill="none" /></g>}
      {t.glasses === 'square' && <g fill="#ffffff" fillOpacity=".18" stroke={INK} strokeWidth="3" strokeLinejoin="round"><rect x="68" y="103" width="28" height="20" rx="7" /><rect x="104" y="103" width="28" height="20" rx="7" /><path d="M96 111H104" fill="none" /></g>}

      <HatShape hat={t.hat} color={d.color} />
    </svg>
  );
});

function Mouth({ mood, style, uid }: { mood: 'idle' | 'happy' | 'sad'; style: 'smile' | 'grin' | 'open'; uid: string }) {
  if (mood === 'sad') return <path d="M90 145Q100 138 110 145" stroke={INK} strokeWidth="3.6" strokeLinecap="round" fill="none" />;
  if (style === 'smile' && mood !== 'happy') return <path d="M89 139Q100 148 111 139" stroke={INK} strokeWidth="3.6" strokeLinecap="round" fill="none" />;
  const shape = mood === 'happy' ? 'M86 137Q100 137 114 137Q113 155 100 155Q87 155 86 137Z' : 'M88 138Q100 138 112 138Q111 151 100 151Q89 151 88 138Z';
  return (
    <g>
      <clipPath id={`m${uid}`}><path d={shape} /></clipPath>
      <path d={shape} fill="#5a1f2a" />
      <g clipPath={`url(#m${uid})`}>
        {style === 'grin' ? <rect x="80" y="134" width="40" height="8" fill="#fff" /> : <rect x="80" y="134" width="40" height="5" fill="#fff" />}
        <ellipse cx="100" cy="156" rx="10" ry="6" fill="#ff8b8b" />
      </g>
    </g>
  );
}

function HatShape({ hat, color }: { hat: Hat; color: string }) {
  switch (hat) {
    case 'cap': return (
      <g>
        <path d="M70 62V76C86 84 114 84 130 76V62Z" fill="#2c2b38" />
        <path d="M38 56L100 34L162 56L100 78Z" fill="#23222d" />
        <path d="M38 56L100 34L162 56L100 41Z" fill="#3a3948" />
        <path d="M100 56L150 60V84" stroke="#ffc53d" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="146" y="82" width="8" height="12" rx="3" fill="#ffc53d" />
        <circle cx="100" cy="56" r="3.5" fill="#ffc53d" />
      </g>
    );
    case 'hardhat': return (
      <g>
        <path d="M51 84C51 50 72 38 100 38C128 38 149 50 149 84Z" fill="#ffc53d" />
        <rect x="93" y="38" width="14" height="46" rx="7" fill="#ffd66e" />
        <path d="M60 70C62 56 72 48 84 45" stroke="#fff" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" fill="none" />
        <rect x="40" y="80" width="120" height="11" rx="5.5" fill="#efa526" />
      </g>
    );
    case 'beret': return (
      <g transform="rotate(-8 100 64)">
        <ellipse cx="100" cy="66" rx="54" ry="18" fill={mix(color, '#000000', 0.25)} />
        <ellipse cx="96" cy="62" rx="46" ry="13" fill={mix(color, '#000000', 0.12)} />
        <rect x="96" y="42" width="6" height="10" rx="3" fill={mix(color, '#000000', 0.25)} />
      </g>
    );
    case 'goggles': return (
      <g>
        <path d="M51 86Q100 66 149 86" stroke="#2c2b38" strokeWidth="7" fill="none" strokeLinecap="round" />
        <rect x="68" y="64" width="28" height="22" rx="10" fill="#2c2b38" />
        <rect x="104" y="64" width="28" height="22" rx="10" fill="#2c2b38" />
        <rect x="71.5" y="67.5" width="21" height="15" rx="7" fill="#8fdcff" />
        <rect x="107.5" y="67.5" width="21" height="15" rx="7" fill="#8fdcff" />
        <path d="M76 71H82M112 71H118" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    );
    case 'wizard': return (
      <g>
        <path d="M60 74C78 52 92 26 108 4C112 30 128 54 140 74Z" fill="#6b4ce0" />
        <path d="M104 18L108 4C110 16 114 26 118 34Z" fill="#8a6ff0" />
        <ellipse cx="100" cy="76" rx="56" ry="11" fill="#5639c4" />
        <path d="M112 42l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z" fill="#ffc53d" />
        <circle cx="88" cy="58" r="2.2" fill="#ffe08a" />
      </g>
    );
    default: return null;
  }
}
