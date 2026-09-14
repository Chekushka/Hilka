import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { t } from '@/lib/i18n';
import './globals.css';

/*
 * Both families need complete Ukrainian Cyrillic coverage, including the
 * Ukrainian-specific glyphs listed in docs/design-brief-python-platform.md.
 * Inter and JetBrains Mono both cover them; most display faces do not.
 * Monospace is reserved for code, output, and anything the student typed. It is
 * not a styling device for labels.
 */
const interface_ = Inter({
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
