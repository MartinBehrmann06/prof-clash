'use client';

/** Share a link with the phone's share sheet, or copy it where there is none. Returns what happened. */
export async function shareLink(path: string, text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = new URL(path, location.origin).toString();
  if (navigator.share) {
    try { await navigator.share({ title: 'Prof Clash', text, url }); return 'shared'; }
    catch (e) { if ((e as Error)?.name === 'AbortError') return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { return 'failed'; }
}
