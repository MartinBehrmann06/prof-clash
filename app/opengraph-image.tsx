import { OG_SIZE, ogImage, wordmark } from '@/lib/server/og';

export const alt = 'Prof Clash: Wessen Vorlesung würdest du lieber besuchen?';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogImage([
    wordmark(120),
    <div key="q" style={{ fontSize: 40, textAlign: 'center' }}>Wessen Vorlesung würdest du lieber besuchen?</div>,
    <div key="s" style={{ fontSize: 26, color: '#5b4a39' }}>1-gegen-1-Duelle zwischen Professoren der ETH Zürich</div>,
  ]);
}
