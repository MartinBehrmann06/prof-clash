// Prof Arena motion system (after Apple's "Designing Fluid Interfaces").
// Springs are described by damping ratio + response; durations only for exits/fades.
import type { Transition } from 'motion/react';

/** damping 1 = no overshoot; < 1 only where a gesture/decision carries momentum */
export const spring = (damping = 1, response = 0.4): Transition => ({
  type: 'spring',
  bounce: Math.max(0, 1 - damping),
  visualDuration: response,
});

export const MOTION = {
  soft: spring(1, 0.45), // layout, entrances, reflow
  snappy: spring(1, 0.3), // UI state (tabs, chips, toggles)
  pop: spring(0.78, 0.42), // the chosen card stepping forward
  press: { duration: 0.12, ease: [0.25, 0.1, 0.25, 1] } as Transition, // pointer-down feedback
  exit: { duration: 0.22, ease: [0.7, 0, 0.84, 0] } as Transition, // expo-in: leave quickly
  fade: { duration: 0.18, ease: 'linear' } as Transition,
  stagger: 0.07, // between the two cards
  layer: 0.09, // portrait → text parallax delay inside a card
  /** vote → next duel; stays short so 20 votes in a row still feel quick */
  revealHold: 0.8,
} as const;

/** Where a flick comes to rest (exponential decay, like scroll deceleration) */
export const project = (velocity: number, decelerationRate = 0.998) =>
  ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
