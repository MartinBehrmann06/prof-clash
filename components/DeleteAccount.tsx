'use client';
import { useState } from 'react';
import { api, useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/feedback';

/** "Delete my account" for logged-in students, with a second click to confirm */
export function DeleteAccount() {
  const { user, signOut } = useSession();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const run = async () => {
    setBusy(true);
    try {
      await api('/api/me', { method: 'DELETE' });
      await signOut();
      toast('Dein Konto ist gelöscht.');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <p>
      {confirm
        ? <>Wirklich löschen? Dein Profil und deine Stimmen sind dann weg.{' '}
            <button className="btn sm red" disabled={busy} onClick={run}>Ja, endgültig löschen</button>{' '}
            <button className="btn sm stone" disabled={busy} onClick={() => setConfirm(false)}>Abbrechen</button></>
        : <button className="btn sm red" onClick={() => setConfirm(true)}>Mein Konto löschen ({user.email})</button>}
    </p>
  );
}
