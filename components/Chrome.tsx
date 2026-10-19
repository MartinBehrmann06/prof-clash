'use client';
import { usePathname } from 'next/navigation';
import { Sky } from './Sky';
import { TopBar } from './TopBar';

/** Backdrop + top bar everywhere except the title screen (it has its own) */
export function Chrome() {
  const path = usePathname();
  if (path === '/') return null;
  return <><Sky /><TopBar /></>;
}

/** Legal links at the bottom of every page except the title screen (it has its own) */
export function Footer() {
  const path = usePathname();
  if (path === '/') return null;
  return <LegalLinks className="site-foot" />;
}

export function LegalLinks({ className }: { className?: string }) {
  return (
    <footer className={className}>
      <span>Unabhängiges Studierendenprojekt · nicht offiziell von der ETH Zürich</span>
      <a href="/impressum">Impressum</a>
      <a href="/datenschutz">Datenschutz</a>
      <a href="/impressum#entfernen">Eintrag entfernen</a>
    </footer>
  );
}
