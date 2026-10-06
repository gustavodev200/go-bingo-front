import { ImageResponse } from 'next/og';
import { PWA_ICONS, findIcon } from '@/lib/pwa/icons';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return PWA_ICONS.map(({ file }) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const icon = findIcon((await params).file);
  if (!icon) return new Response('Not found', { status: 404 });
  const fontSize = Math.round(icon.size * (icon.maskable ? 0.5 : 0.64));
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#4c1d95',
          color: '#ffffff',
          fontSize,
          fontWeight: 900,
        }}
      >
        B
      </div>
    ),
    { width: icon.size, height: icon.size },
  );
}
