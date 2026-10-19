'use client';
import { MotionConfig } from 'motion/react';

/** Honour "reduce motion": Motion skips transform/layout animations, keeps opacity fades */
export function Motion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
