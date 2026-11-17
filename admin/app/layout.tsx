import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { Providers } from '@/components/providers';
import { PALETTE_COOKIE, PALETTES_CSS, getPalette, paletteClass } from '@/lib/palettes';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'MAEYJA Yönetim', template: '%s · MAEYJA Yönetim' },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The colour palette picked in the top bar; an unknown cookie value falls back to the default.
  const palette = getPalette((await cookies()).get(PALETTE_COOKIE)?.value).id;
  return (
    <html lang="tr" className={cn('font-sans antialiased', inter.variable, paletteClass(palette))}>
      <head>
        <style>{PALETTES_CSS}</style>
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        <Providers palette={palette}>{children}</Providers>
      </body>
    </html>
  );
}
