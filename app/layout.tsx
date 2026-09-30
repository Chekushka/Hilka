import type { Metadata } from 'next';
import { JetBrains_Mono, Onest } from 'next/font/google';
import { t } from '@/lib/i18n';
import './globals.css';

/*
 * Both families need complete Ukrainian Cyrillic coverage, including the
 * Ukrainian-specific glyphs listed in docs/design-brief-python-platform.md.
 * Onest (the humanist sans the mockups are set in, and one the brief names)
 * and JetBrains Mono both cover them; most display faces do not. Inter stays
 * in the CSS fallback stack (app/globals.css).
 * Monospace is reserved for code, output, and anything the student typed. It is
 * not a styling device for labels.
 */
const interface_ = Onest({
  variable: '--font-ui',
  subsets: ['latin', 'cyrillic'],
  display: 'swap'
});

const code = JetBrains_Mono({
  variable: '--font-code',
  subsets: ['latin', 'cyrillic'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Hilka',
  description: t('meta.description')
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="uk" className={`${interface_.variable} ${code.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
