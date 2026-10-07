import type { Metadata, Viewport } from 'next';
import { Fredoka, Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { StageBackdrop } from '@/components/stage/stage';
import { OfflineBanner } from '@/features/pwa/offline-banner';
import { PwaProvider } from '@/features/pwa/pwa-provider';
import './globals.css';

const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const fredoka = Fredoka({ variable: '--font-display', subsets: ['latin'], weight: ['500', '600', '700'] });

export const metadata: Metadata = {
  applicationName: 'Go Bingo',
  title: 'Go Bingo',
  description: 'Bingo multiplayer com os amigos',
  appleWebApp: { capable: true, title: 'Go Bingo', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/pwa-icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/pwa-icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2e1065',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${geistSans.variable} ${geistMono.variable} ${fredoka.variable}`}>
      {/* suppressHydrationWarning: extensões do navegador (ex.: ColorZilla) injetam atributos no <body> antes da hidratação. */}
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased" suppressHydrationWarning>
        <StageBackdrop />
        <div className="min-h-dvh pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
          <PwaProvider>
            <OfflineBanner />
            {children}
          </PwaProvider>
        </div>
        <Toaster position="top-center" theme="dark" />
      </body>
    </html>
  );
}
