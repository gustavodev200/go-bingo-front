import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { OfflineBanner } from '@/features/pwa/offline-banner';
import { PwaProvider } from '@/features/pwa/pwa-provider';
import './globals.css';

const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  applicationName: 'Go Bingo',
  title: 'Go Bingo',
  description: 'Bingo multiplayer com os amigos',
  appleWebApp: { capable: true, title: 'Go Bingo', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: { apple: '/pwa-icons/icon-192.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#4c1d95',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      {/* suppressHydrationWarning: extensões do navegador (ex.: ColorZilla) injetam atributos no <body> antes da hidratação. */}
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased" suppressHydrationWarning>
        <div className="min-h-dvh pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
          <PwaProvider>
            <OfflineBanner />
            {children}
          </PwaProvider>
        </div>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
