import type { Metadata } from 'next';
import {
  Playfair_Display,
  Cormorant_Garamond,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Classic Chess 3D',
  description:
    'Permainan catur 3D klasik bergaya Staunton dengan aturan FIDE lengkap dan room multiplayer real-time tersinkronisasi.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/apple-icon',
  },
  openGraph: {
    title: 'Classic Chess 3D',
    description:
      'Permainan catur 3D klasik bergaya Staunton dengan aturan FIDE lengkap dan room multiplayer real-time tersinkronisasi.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Classic Chess 3D',
    description:
      'Permainan catur 3D klasik bergaya Staunton dengan aturan FIDE lengkap dan room multiplayer real-time tersinkronisasi.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${playfair.variable} ${cormorant.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#E1D4C2] text-[#291C0E] font-sans antialiased selection:bg-[#6E473B] selection:text-[#E1D4C2]"
      >
        {children}
      </body>
    </html>
  );
}
