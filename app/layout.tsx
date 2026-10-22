import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { Lilita_One, Nunito } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SessionProvider } from '@/lib/client/session';
import { ToastProvider } from '@/lib/client/feedback';
import { ProfileProvider } from '@/components/Profile';
import { CloudTransition } from '@/components/CloudTransition';
import { Motion } from '@/components/Motion';
import { Chrome, Footer } from '@/components/Chrome';
import { Onboarding } from '@/components/Onboarding';
import './globals.css';

const display = Lilita_One({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const body = Nunito({ weight: ['500', '600', '700', '800'], subsets: ['latin'], variable: '--font-body' });

const description = 'Wessen Vorlesung würdest du lieber besuchen? 1-gegen-1-Duelle zwischen Professoren der ETH Zürich. Unabhängiges Studierendenprojekt.';

export const metadata: Metadata = {
  title: 'Prof Clash',
  description,
  openGraph: { title: 'Prof Clash', description, siteName: 'Prof Clash', locale: 'de_CH', type: 'website' },
  twitter: { card: 'summary_large_image' },
  appleWebApp: { capable: true, title: 'Prof Clash' },
  icons: { apple: '/apple-touch-icon.png', icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><clipPath id='c'><rect width='40' height='40' rx='12'/></clipPath><g clip-path='url(%23c)'><rect width='40' height='40' fill='%233d6bff'/><path d='M25 0H40V40H13Z' fill='%23ff5a4a'/><path d='M23 -2L27 -2L15 42L11 42Z' fill='white'/></g></svg>" },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f5f3ee' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // render per request, so every page gets its own CSP nonce (middleware.ts)
  await connection();
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
                <Footer />
                <Onboarding />
              </ProfileProvider>
            </CloudTransition>
          </ToastProvider>
        </SessionProvider>
        </Motion>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
