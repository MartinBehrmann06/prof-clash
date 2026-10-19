import type { Metadata, Viewport } from 'next';
import { Lilita_One, Nunito } from 'next/font/google';
import { SessionProvider } from '@/lib/client/session';
import { ToastProvider } from '@/lib/client/feedback';
import { ProfileProvider } from '@/components/Profile';
import { CloudTransition } from '@/components/CloudTransition';
import { Motion } from '@/components/Motion';
import { Chrome } from '@/components/Chrome';
import './globals.css';

const display = Lilita_One({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const body = Nunito({ weight: ['700', '800', '900'], subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Prof Clash',
  description: 'Wessen Vorlesung würdest du lieber besuchen? 1-gegen-1-Duelle zwischen Professoren der ETH Zürich. Unabhängiges Studierendenprojekt.',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚔️</text></svg>" },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#3fa9f5' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${display.variable} ${body.variable}`}>
      <body>
        <Motion>
        <SessionProvider>
          <ToastProvider>
            <CloudTransition>
              <ProfileProvider>
                <Chrome />
                <main id="app">{children}</main>
              </ProfileProvider>
            </CloudTransition>
          </ToastProvider>
        </SessionProvider>
        </Motion>
      </body>
    </html>
  );
}
