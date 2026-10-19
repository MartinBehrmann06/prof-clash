import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from '@/lib/client/session';
import { ToastProvider } from '@/lib/client/feedback';
import { ProfileProvider } from '@/components/Profile';
import { Stage } from '@/components/Stage';
import { Motion } from '@/components/Motion';
import { Nav } from '@/components/Nav';
import './globals.css';

// SF Pro on Apple devices; Inter as the fallback elsewhere
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Prof Arena',
  description: 'Wessen Vorlesung würdest du lieber besuchen? 1-gegen-1-Duelle zwischen Professoren der ETH Zürich. Unabhängiges Studierendenprojekt.',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='28' fill='%23e9e9e6'/><circle cx='50' cy='50' r='20' fill='none' stroke='%232a2c31' stroke-width='7'/></svg>" },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0b0c0f' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={inter.variable}>
      <body>
        <Motion>
        <SessionProvider>
          <ToastProvider>
            <Stage>
              <ProfileProvider>
                <Nav />
                <main id="app">{children}</main>
              </ProfileProvider>
            </Stage>
          </ToastProvider>
        </SessionProvider>
        </Motion>
      </body>
    </html>
  );
}
