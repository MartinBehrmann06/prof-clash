import type { Metadata, Viewport } from 'next';
import { Bungee, Rubik } from 'next/font/google';
import { SessionProvider } from '@/lib/client/session';
import { ToastProvider } from '@/lib/client/feedback';
import { ProfSheetProvider } from '@/components/ProfSheet';
import { Arena } from '@/components/Arena';
import { Motion } from '@/components/Motion';
import { TopBar } from '@/components/TopBar';
import './globals.css';

const display = Bungee({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const body = Rubik({ weight: ['400', '500', '700', '900'], subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Prof Clash — ETH Zurich',
  description: '1v1 Elo battles between the professors of ETH Zurich’s mandatory bachelor courses.',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚔️</text></svg>" },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#07051a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Motion>
        <SessionProvider>
          <ToastProvider>
            <ProfSheetProvider>
              <Arena />
              <TopBar />
              <main id="app">{children}</main>
            </ProfSheetProvider>
          </ToastProvider>
        </SessionProvider>
        </Motion>
      </body>
    </html>
  );
}
