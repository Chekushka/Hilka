import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

/*
 * Both families need complete Ukrainian Cyrillic — і, ї, є, ґ and the
 * apostrophe. Inter and JetBrains Mono both cover it; most display faces do not.
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
  description: 'Python для 7–9 класу'
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="uk" className={`${interface_.variable} ${code.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
