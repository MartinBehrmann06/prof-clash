'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/feedback';
import { MOTION } from '@/lib/client/motion';
import { levelProgress } from '@/lib/game';
import { Icon, LogoMark, XpStar } from './art';
import { GameLink } from './CloudTransition';

const NAV = [['/battle', 'Battle'], ['/rankings', 'Rankings'], ['/departments', 'Weekend League']] as const;

/** Dark HUD bar: logo, nav with a sliding gold pill, player level */
export function TopBar() {
  const path = usePathname();
  const { user, profile, signOut } = useSession();
  const toast = useToast();
  const nav = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null);
  const placed = useRef(false); // the first placement jumps, later ones slide

  // One pill that slides between links, measured against the nav itself. A shared layoutId
  // measures in page coordinates, so after a page switch resets the scroll the pill flew in
  // from wherever the sticky bar sat on the old page.
  useLayoutEffect(() => {
    const el = nav.current;
    if (!el) return;
    const measure = () => {
      const a = el.querySelector<HTMLElement>('a[aria-current="page"]');
      setPill(a ? { x: a.offsetLeft, width: a.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure); // fonts loading, mobile breakpoint
    el.querySelectorAll('a').forEach((a) => ro.observe(a));
    return () => ro.disconnect();
  }, [path]);

  return (
    <header className="topbar">
      <GameLink href="/" className="logo" aria-label="Prof Clash Startseite" label="Prof Clash">
        <LogoMark /><span className="logo-text">PROF <em>CLASH</em></span>
      </GameLink>
      <nav className="nav" aria-label="Hauptnavigation" ref={nav}>
        <motion.span className="pill" aria-hidden initial={false} transition={placed.current ? MOTION.snappy : { duration: 0 }}
          onAnimationComplete={() => { if (pill) placed.current = true; }}
          animate={pill ? { x: pill.x, width: pill.width, opacity: 1 } : { opacity: 0 }} />
        {NAV.map(([href, text]) => {
          const on = path.startsWith(href);
          return (
            <GameLink key={href} href={href} label={text} className={text.includes(' ') ? 'two' : undefined} aria-current={on ? 'page' : undefined}>
              {text}
            </GameLink>
          );
        })}
      </nav>
      <div className="me">
        {!user ? <GameLink className="btn sm gold" href="/login">Login</GameLink> : <>
          {profile && (
            <GameLink href="/me" className="me-link" title="Dein Profil">
              <XpStar level={profile.level} />
              <span className="xp-bar" aria-label="XP"><i style={{ width: `${Math.round(levelProgress(profile.xp) * 100)}%` }} /></span>
            </GameLink>
          )}
          <button className="btn sm stone icon-only" aria-label={`Abmelden (${user.email})`} title={`Abmelden (${user.email})`}
            onClick={async () => { await signOut(); toast('Bis bald!'); }}><Icon name="power" /></button>
        </>}
      </div>
    </header>
  );
}
