'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/feedback';
import { levelProgress } from '@/lib/game';
import { XpStar } from './art';

export function TopBar() {
  const path = usePathname();
  const { user, profile, signOut } = useSession();
  const toast = useToast();
  const nav = [['/battle', 'Battle'], ['/leaderboard', 'Leaderboard']] as const;
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Prof Clash home">
        <span className="brand-mark">⚔</span><span className="brand-text">PROF CLASH</span>
      </Link>
      <nav className="nav">
        {nav.map(([href, label]) => <Link key={href} href={href} className={path.startsWith(href) ? 'active' : ''}>{label}</Link>)}
      </nav>
      <div className="me-chip">
        {!user ? <Link className="btn small gold" href="/login">Log in</Link> : <>
          {profile && (
            <Link href="/setup" className="me-link" title="Your roster">
              <XpStar level={profile.level} />
              <div className="xp-bar" aria-label="XP progress"><i style={{ width: `${Math.round(levelProgress(profile.xp) * 100)}%` }} /></div>
            </Link>
          )}
          <button className="btn small stone" id="logout" aria-label={`Log out ${user.email}`} title={`Log out ${user.email}`}
            onClick={async () => { await signOut(); toast('Logged out — see you on the battlefield'); }}>⏻</button>
        </>}
      </div>
    </header>
  );
}
