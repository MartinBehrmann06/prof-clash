'use client';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/feedback';
import { MOTION } from '@/lib/client/motion';
import { levelProgress } from '@/lib/game';
import { XpStar } from './art';
import { GameLink } from './CloudTransition';

const NAV = [['/battle', 'Battle', '⚔️ Battle!'], ['/rankings', 'Rankings', '🏆 Rankings'], ['/departments', 'Clans', '🛡️ Clans']] as const;

/** Wooden HUD bar: logo, nav with a sliding pill, player level */
export function TopBar() {
  const path = usePathname();
  const { user, profile, signOut } = useSession();
  const toast = useToast();
  return (
    <header className="topbar">
      <GameLink href="/" className="logo" aria-label="Prof Clash Startseite" label="Prof Clash">
        <span className="logo-shield">⚔</span><span className="logo-text">PROF CLASH</span>
      </GameLink>
      <nav className="nav" aria-label="Hauptnavigation">
        {NAV.map(([href, text, label]) => {
          const on = path.startsWith(href);
          return (
            <GameLink key={href} href={href} label={label} aria-current={on ? 'page' : undefined}>
              {on && <motion.span layoutId="nav-pill" className="pill" transition={MOTION.snappy} />}
              {text}
            </GameLink>
          );
        })}
      </nav>
      <div className="me">
        {!user ? <GameLink className="btn sm gold" href="/login">Login</GameLink> : <>
          {profile && (
            <GameLink href="/setup" className="me-link" title="Dein Fortschritt">
              <XpStar level={profile.level} />
              <span className="xp-bar" aria-label="XP"><i style={{ width: `${Math.round(levelProgress(profile.xp) * 100)}%` }} /></span>
            </GameLink>
          )}
          <button className="btn sm stone" aria-label={`Abmelden (${user.email})`} title={`Abmelden (${user.email})`}
            onClick={async () => { await signOut(); toast('Bis bald, Held!'); }}>⏻</button>
        </>}
      </div>
    </header>
  );
}
