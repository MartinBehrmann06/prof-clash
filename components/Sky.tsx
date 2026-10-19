'use client';
/** Sunny sky with drifting clouds and hills behind every page except the 3D title screen */
export function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      <div className="sun" />
      <div className="cloud c1" /><div className="cloud c2" /><div className="cloud c3" />
      <svg className="hills" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path className="h1" d="M0 190 C 200 110 380 120 560 170 S 920 230 1080 160 S 1340 100 1440 140 V320 H0Z" />
        <path className="h2" d="M0 240 C 180 180 360 200 540 230 S 900 270 1100 215 S 1360 190 1440 210 V320 H0Z" />
        <path className="h3" d="M0 280 C 240 250 480 260 720 280 S 1200 300 1440 270 V320 H0Z" />
      </svg>
    </div>
  );
}
