'use client';
import { useCallback, useState } from 'react';
import { BattleRing, type Pair } from '@/components/BattleRing';
import { eloUpdate, league } from '@/lib/game';
import type { RankedProf } from '@/lib/types';

const LEAGUE_ELO = [1050, 1150, 1200, 1280, 1350, 1450, 1550]; // one per league, to preview rarities

export function DevArena({ profs }: { profs: RankedProf[] }) {
  const [round, setRound] = useState(1);
  const make = (r: number): Pair => {
    const a = profs[(r * 2) % profs.length], b = profs[(r * 2 + 1) % profs.length];
    const ea = LEAGUE_ELO[r % LEAGUE_ELO.length], eb = LEAGUE_ELO[(r + 3) % LEAGUE_ELO.length];
    const card = (p: RankedProf, elo: number) => ({ ...p, elo, league: league(elo), courses: [{ title: 'Linear Algebra', code: '', semester: 1, term: '2025W' }] });
    return { left: card(a, ea), right: card(b, eb), round: r };
  };
  const [pair, setPair] = useState<Pair>(() => make(1));
  const next = useCallback(() => { setRound((r) => { const n = r + 1; setPair(make(n)); return n; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="battle">
      <div className="round"><h1>Dev arena</h1><p>Animation playground — votes here are fake. Round {round}.</p></div>
      <BattleRing pair={pair} onNext={next} onVote={async (side) => {
        const w = pair[side], l = pair[side === 'left' ? 'right' : 'left'];
        const [nw, nl, d] = eloUpdate(w.elo, l.elo);
        return { delta: Math.round(d), winnerElo: Math.round(nw), loserElo: Math.round(nl) };
      }} />
    </div>
  );
}
