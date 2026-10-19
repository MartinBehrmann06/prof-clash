'use client';
import { useEffect, useRef } from 'react';

/** The sky, sun, drifting clouds and parallax hills behind every page */
export function Sky() {
  const hills = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const paths = hills.current ? [...hills.current.querySelectorAll('path')] : [];
    const onScroll = () => paths.forEach((p, i) => { p.style.transform = `translateY(${scrollY * (0.05 + i * 0.07)}px)`; });
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="sky" aria-hidden="true">
      <div className="sun"><div className="rays" /></div>
      <div className="cloud c1" /><div className="cloud c2" /><div className="cloud c3" /><div className="cloud c4" />
      <svg ref={hills} className="hills" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path className="hill-back" d="M0 190 C 200 110 380 120 560 170 S 920 230 1080 160 S 1340 100 1440 140 V320 H0Z" />
        <path className="hill-mid" d="M0 240 C 180 180 360 200 540 230 S 900 270 1100 215 S 1360 190 1440 210 V320 H0Z" />
        <path className="hill-front" d="M0 280 C 240 250 480 260 720 280 S 1200 300 1440 270 V320 H0Z" />
      </svg>
    </div>
  );
}
