'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/feedback';
import { spring } from '@/lib/client/motion';
import { levelProgress } from '@/lib/game';

const NAV = [['/battle', 'Battle'], ['/leaderboard', 'Rankings']] as const;

/** Translucent HUD: logo, nav with a sliding pill, player level + XP */
export function TopBar() {
  const path = usePathname();
  const { user, profile, signOut } = useSession();
  const toast = useToast();
  return (
    <header className="hud-bar">
      <Link href="/" className="logo" aria-label="Prof Clash home">
        <span className="logo-mark">⚔</span><span className="logo-text">PROF<b>CLASH</b></span>
      </Link>
      <nav className="nav">
        {NAV.map(([href, label]) => {
          const active = path.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? 'active' : ''}>
              {active && <motion.span layoutId="nav-pill" className="nav-pill" transition={spring(1, 0.35)} />}
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="hud-me">
        {!user ? <Link className="gbtn sm" href="/login">Log in</Link> : <>
          {profile && (
            <Link href="/setup" className="hud-me" style={{ textDecoration: 'none', color: 'inherit' }} title="Your roster">
              <span className="level-hex">{profile.level}</span>
              <span className="xp"><small>Level {profile.level} · {profile.xp} XP</small>
                <span className="bar"><motion.i initial={false} animate={{ width: `${Math.round(levelProgress(profile.xp) * 100)}%` }} transition={spring(1, 0.5)} /></span></span>
            </Link>
          )}
          <button className="icon-btn" aria-label={`Log out ${user.email}`} title={`Log out ${user.email}`}
            onClick={async () => { await signOut(); toast('Logged out — see you in the arena'); }}>⏻</button>
        </>}
      </div>
    </header>
  );
}
