'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/feedback';
import { MOTION } from '@/lib/client/motion';

const TABS = [['/', 'Battle'], ['/rankings', 'Rankings'], ['/departments', 'Departments']] as const;

/** Floating glass navigation; the active pill glides between tabs */
export function Nav() {
  const path = usePathname();
  const { user, profile, signOut } = useSession();
  const toast = useToast();
  const isOn = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <div className="nav-wrap">
      <nav className="nav" aria-label="Hauptnavigation">
        <Link href="/" className="brand" aria-label="Prof Arena"><span className="brand-mark" /><span>Prof Arena</span></Link>
        <div className="tabs">
          {TABS.map(([href, label]) => (
            <Link key={href} href={href} className={`tab ${isOn(href) ? 'on' : ''}`} aria-current={isOn(href) ? 'page' : undefined}>
              {isOn(href) && <motion.span layoutId="nav-pill" className="pill" transition={MOTION.snappy} />}
              {label}
            </Link>
          ))}
        </div>
        <div className="me">
          {!user ? <Link className="btn sm" href="/login">Anmelden</Link> : <>
            <Link href="/setup" className="me-chip" title="Dein Fortschritt und deine Professorenliste">
              <span className="lvl">{profile?.level ?? '–'}</span><span className="txt">{profile ? `${profile.votes} Duelle` : 'Einrichten'}</span>
            </Link>
            <button className="icon-btn" aria-label={`Abmelden (${user.email})`} title={`Abmelden (${user.email})`}
              onClick={async () => { await signOut(); toast('Abgemeldet'); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0" /></svg>
            </button>
          </>}
        </div>
      </nav>
    </div>
  );
}
