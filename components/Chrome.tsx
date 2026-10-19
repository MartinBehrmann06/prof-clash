'use client';
import { usePathname } from 'next/navigation';
import { Sky } from './Sky';
import { TopBar } from './TopBar';

/** Sky + top bar everywhere except the immersive 3D title screen */
export function Chrome() {
  const path = usePathname();
  if (path === '/') return null;
  return <><Sky /><TopBar /></>;
}
