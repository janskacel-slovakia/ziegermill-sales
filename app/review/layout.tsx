import type { Metadata, Viewport } from 'next';
import { Google_Sans } from 'next/font/google';

// The architect review (19 Oct 2026) in the Ziegermill identity, as /admin.
const googleSans = Google_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '700'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Ziegermill – pripomienky k výkresom', robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${googleSans.className} min-h-screen bg-zm-paper text-zm-ink antialiased`} style={{ colorScheme: 'light' }}>
      {children}
    </div>
  );
}
