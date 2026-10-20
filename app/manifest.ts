import type { MetadataRoute } from 'next';

// "Zum Home-Bildschirm": opens full screen like an app, straight into the battle
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Prof Clash',
    short_name: 'Prof Clash',
    description: 'Wessen Vorlesung würdest du lieber besuchen? 1-gegen-1-Duelle zwischen Professoren der ETH Zürich.',
    lang: 'de',
    start_url: '/battle',
    display: 'standalone',
    background_color: '#84c03c',
    theme_color: '#f5f3ee',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
