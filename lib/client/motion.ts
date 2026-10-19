// Apple-style motion helpers (see "Designing Fluid Interfaces"):
// springs described by damping ratio + response, momentum projection, rubber-banding.
import type { Transition } from 'motion/react';

/** damping 1 = no overshoot (default UI); < 1 only after momentum (flicks, throws) */
export const spring = (damping = 1, response = 0.4): Transition => ({
  type: 'spring',
  bounce: Math.max(0, 1 - damping),
  visualDuration: response,
});

/** Where a flick will come to rest (exponential decay, like scroll deceleration) */
export const project = (velocity: number, decelerationRate = 0.998) =>
  ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
