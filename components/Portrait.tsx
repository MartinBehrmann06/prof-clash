'use client';
import { useState } from 'react';
import { deptByName } from '@/lib/departments';

/**
 * Professor portrait in a fixed aspect-ratio box (no layout shift); the photo fades in once
 * decoded. Without a photo: the initials over a soft light in the department colour.
 */
export function Portrait({ p, className = '', eager = false }: {
  p: { id: number; name: string; image: string | null; department?: string }; className?: string; eager?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);
  const w = p.name.split(/\s+/).filter(Boolean);
  const initials = ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
  return (
    <div className={`portrait ${className}`} style={{ ['--accent' as any]: deptByName(p.department).color }}>
      {(!p.image || broken) && <div className="mono">{initials}</div>}
      {p.image && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/${p.image}`} alt={p.name} draggable={false} loading={eager ? 'eager' : 'lazy'} decoding="async"
          className={ready ? 'ready' : ''} ref={(el) => { if (el?.complete && el.naturalWidth) setReady(true); }}
          onLoad={() => setReady(true)} onError={() => setBroken(true)} />
      )}
    </div>
  );
}
