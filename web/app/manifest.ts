import type { MetadataRoute } from 'next';

/** "Add to home screen" on Android/Chrome; the browser tab icon comes from app/icon.svg + favicon.ico. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MAEYJA',
    short_name: 'MAEYJA',
    description: 'Hand crafted elegance.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F4F0',
    theme_color: '#1A1A1A',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // The monogram sits well inside the 80% safe zone, so the same file works when Android crops it.
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
