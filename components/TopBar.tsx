'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/feedback';
import { MOTION } from '@/lib/client/motion';
import { ethUser } from '@/lib/game';
import { Icon, LogoMark } from './art';
import { Avatar } from './Avatar';
import { GameLink } from './CloudTransition';

const NAV = [['/battle', 'Battle'], ['/rankings', 'Rankings'], ['/departments', 'Weekend League']] as const;

/** Dark HUD bar: logo, nav with a sliding gold pill, player */
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
        {/* mounted only while a link is active instead of faded with opacity: the opacity animation put the pill on
            its own compositor layer, the likely reason it was sometimes drawn with its border but without the gold */}
        {pill && <motion.span className="pill" aria-hidden initial={false} transition={placed.current ? MOTION.snappy : { duration: 0 }}
          onAnimationComplete={() => { placed.current = true; }} animate={{ x: pill.x, width: pill.width }} />}
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
          {profile ? (
            <GameLink href="/me" className="me-link" title="Dein Profil und dein persönliches Ranking" label="Dein Profil">
              <span className="me-av">
                <Avatar username={profile.username} department={profile.deptName} size={38} />
              </span>
              <span className="me-text"><b className="me-name">{profile.username}</b></span>
            </GameLink>
          ) : (
            <GameLink href="/setup" className="me-link" title="Profil einrichten">
              <span className="me-av"><Avatar username={ethUser(user.email)} size={38} /></span>
              <span className="me-text"><b className="me-name">{ethUser(user.email)}</b></span>
            </GameLink>
          )}
          <button className="btn sm stone icon-only" aria-label={`Abmelden (${user.email})`} title={`Abmelden (${user.email})`}
            onClick={async () => { await signOut(); toast('Bis bald!'); }}><Icon name="power" /></button>
        </>}
      </div>
    </header>
  );
}
