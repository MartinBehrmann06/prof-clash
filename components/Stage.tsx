'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

type Pools = [string, string] | null;
const Ctx = createContext<(p: Pools) => void>(() => {});
/** Pages set the two department light colours behind the duel (or null to dim them) */
export const useStageLights = () => useContext(Ctx);

/**
 * The room: an overhead key light, a floor bounce, two department-coloured light pools
 * and fine grain. Layers drift a few pixels against the pointer at different depths.
 */
export function Stage({ children }: { children: React.ReactNode }) {
  const [pools, setPools] = useState<Pools>(null);
  const reduced = useReducedMotion();
  const px = useMotionValue(0), py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 20 }), sy = useSpring(py, { stiffness: 60, damping: 20 });
  const far = { x: useTransform(sx, (v) => v * -8), y: useTransform(sy, (v) => v * -6) };
  const near = { x: useTransform(sx, (v) => v * -22), y: useTransform(sy, (v) => v * -14) };

  useEffect(() => {
    if (reduced || matchMedia('(pointer: coarse)').matches) return;
    const onMove = (e: PointerEvent) => { px.set(e.clientX / innerWidth - 0.5); py.set(e.clientY / innerHeight - 0.5); };
    addEventListener('pointermove', onMove, { passive: true });
    return () => removeEventListener('pointermove', onMove);
  }, [reduced, px, py]);

  return (
    <Ctx.Provider value={setPools}>
      <div className="stage" aria-hidden="true">
        <motion.div className="layer key" style={far} />
        <motion.div className="layer floor" style={far} />
        <motion.div className="layer" style={near}>
          <div className={`pool l ${pools ? 'on' : ''}`} style={{ backgroundColor: pools?.[0] }} />
          <div className={`pool r ${pools ? 'on' : ''}`} style={{ backgroundColor: pools?.[1] }} />
        </motion.div>
        <div className="grain" />
        <div className="vignette" />
      </div>
      {children}
    </Ctx.Provider>
  );
}
