import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Go Bingo',
    short_name: 'Go Bingo',
    description: 'Bingo multiplayer com os amigos',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    lang: 'pt-BR',
    background_color: '#ffffff',
    theme_color: '#4c1d95',
    icons: [
      { src: '/pwa-icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
