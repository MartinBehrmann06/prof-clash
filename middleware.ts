import { NextResponse, type NextRequest } from 'next/server';

/**
 * Strict Content Security Policy with a fresh nonce per request. Next.js reads the nonce
 * from the request's CSP header and puts it on its own inline scripts; scripts those load
 * (Vercel Analytics, Speed Insights) are allowed through 'strict-dynamic'.
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === 'development';
  const supabase = process.env.SUPABASE_URL ?? '';
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? ` 'unsafe-eval'` : ''}`,
    // React and Motion set style attributes
    `style-src 'self' 'unsafe-inline'`,
    // figures are rendered to blob: URLs, the favicon is a data: SVG
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabase}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [{
    // pages only: API routes, build assets and images carry no scripts
    source: '/((?!api|_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:png|svg|jpg|webp|ico|webmanifest)$).*)',
    missing: [
      { type: 'header', key: 'next-router-prefetch' },
      { type: 'header', key: 'purpose', value: 'prefetch' },
    ],
  }],
};
