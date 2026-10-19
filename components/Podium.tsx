'use client';
import { motion } from 'motion/react';
import { useOpenProf } from './ProfSheet';
import { ProfCard } from './ProfCard';
import type { Prof } from '@/lib/types';

/** Top three on blocks, the champion in the middle; blocks rise in when shown */
export function Podium({ top, style }: { top: Prof[]; style?: React.CSSProperties }) {
  const open = useOpenProf();
  if (top.length < 3) return null;
  return (
    <div className="podium" style={style}>
      {[1, 0, 2].map((i, col) => {
        const p = top[i], place = i + 1;
        return (
          <motion.button type="button" key={p.id} className={`pod p${place}`} onClick={() => open(p.id)}
            initial={{ y: 60, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}
            transition={{ type: 'spring', bounce: 0.3, visualDuration: 0.6, delay: [0.2, 0, 0.35][col] }}>
            {place === 1 && <div className="crown">👑</div>}
            <ProfCard p={p} />
            <div className="pod-block"><div className="pod-place">#{place}</div></div>
          </motion.button>
        );
      })}
    </div>
  );
}
