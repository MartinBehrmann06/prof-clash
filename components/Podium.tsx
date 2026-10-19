'use client';
import { useOpenProf } from './ProfSheet';
import { Portrait, Trophies } from './art';
import type { Prof } from '@/lib/types';

/** Top three on wooden/gold/silver/bronze blocks, winner in the middle */
export function Podium({ top, style }: { top: Prof[]; style?: React.CSSProperties }) {
  const open = useOpenProf();
  if (top.length < 3) return null;
  return (
    <div className="podium" style={style}>
      {[1, 0, 2].map((i) => {
        const p = top[i], place = i + 1;
        return (
          <button type="button" key={p.id} className={`pod p${place}`} onClick={() => open(p.id)} style={{ background: 'none', border: 0, padding: 0, font: 'inherit' }}>
            {place === 1 && <div className="crown">👑</div>}
            <Portrait p={p} />
            <div className="block"><div className="place">{place}</div><div className="pname">{p.name}</div><Trophies n={p.elo} /></div>
          </button>
        );
      })}
    </div>
  );
}
