'use client';
import { useToast } from '@/lib/client/feedback';
import { shareLink } from '@/lib/client/share';
import { Icon } from './art';

/** Opens the share sheet; on desktop the link is copied instead */
export function ShareButton({ path, text, label = 'Teilen', className = 'btn sm blue' }: { path: string; text: string; label?: string; className?: string }) {
  const toast = useToast();
  const share = async () => {
    const r = await shareLink(path, text);
    if (r === 'copied') toast('Link kopiert');
    if (r === 'failed') toast('Teilen hat nicht geklappt', 'err');
  };
  return <button type="button" className={className} onClick={share}><Icon name="share" size={15} /> {label}</button>;
}
