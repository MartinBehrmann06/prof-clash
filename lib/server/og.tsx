import 'server-only';
import { ImageResponse } from 'next/og';

// Link previews (WhatsApp, Telegram, iMessage …): the title screen's blue/coral split with one white card.

export const OG_SIZE = { width: 1200, height: 630 };
const INK = '#1e1712', GOLD = '#ffe36b', BLUE = '#3d6bff', CORAL = '#ff5a4a';

// Satori needs TTF/OTF, so ask Google Fonts with a user agent that gets TTF back
async function googleFont(family: string, weight: number) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1' },
  })).text();
  const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error(`no TTF for ${family}`);
  return { name: family, data: await (await fetch(url)).arrayBuffer(), weight: weight as 400 | 800, style: 'normal' as const };
}

let fonts: Promise<Awaited<ReturnType<typeof googleFont>>[]> | null = null;
// without the fonts the preview still renders, in the default sans
const loadFonts = () => (fonts ??= Promise.all([googleFont('Lilita One', 400), googleFont('Nunito', 800)]).catch(() => { fonts = null; return []; }));

export const wordmark = (size: number) => (
  <div key="wordmark" style={{ display: 'flex', fontFamily: 'Lilita One', fontSize: size, color: GOLD, WebkitTextStroke: `${size * 0.1}px ${INK}`, textShadow: `0 ${size * 0.08}px 0 ${INK}` }}>
    PROF CLASH
  </div>
);

/** Satori lays out a fragment's children as one row, so the card's lines come as an array */
export async function ogImage(lines: React.ReactNode[]) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito', color: INK,
        backgroundImage: `linear-gradient(105deg, ${BLUE} 0%, ${BLUE} 56%, #ffffff 56%, #ffffff 59%, ${CORAL} 59%, ${CORAL} 100%)` }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '44px 64px', maxWidth: 1000,
          background: '#f5f3ee', border: `6px solid ${INK}`, borderRadius: 40, boxShadow: `0 12px 0 ${INK}` }}>
          {lines}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
