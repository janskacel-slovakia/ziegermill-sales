import type { Metadata } from 'next';
import { Google_Sans } from 'next/font/google';

// The admin in the Ziegermill identity: Google Sans (the identity's free font), brand colours from globals.css.
const googleSans = Google_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '700'], display: 'swap' });

export const metadata: Metadata = { title: 'Ziegermill – administrácia predaja', robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${googleSans.className} min-h-screen bg-zm-paper text-zm-ink antialiased`} style={{ colorScheme: 'light' }}>
      {children}
    </div>
  );
}
