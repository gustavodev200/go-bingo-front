import { ImageResponse } from 'next/og';
import { PWA_ICONS, findIcon } from '@/lib/pwa/icons';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return PWA_ICONS.map(({ file }) => ({ file }));
}

// Diâmetro da bola relativo ao ícone. Maskable fica menor para caber na safe zone (círculo de 80%).
function ballRatio({ maskable, transparent }: { maskable: boolean; transparent?: boolean }) {
  if (transparent) return 0.96;
  return maskable ? 0.56 : 0.78;
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const icon = findIcon((await params).file);
  if (!icon) return new Response('Not found', { status: 404 });
  const ball = Math.round(icon.size * ballRatio(icon));
  const disc = Math.round(ball * 0.58);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: icon.transparent ? 'transparent' : '#4c1d95',
        }}
      >
        <div
          style={{
            width: ball,
            height: ball,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: 'radial-gradient(circle at 35% 30%, #f87171 0%, #dc2626 55%, #991b1b 100%)',
          }}
        >
          <div
            style={{
              width: disc,
              height: disc,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ffffff',
              color: '#1e1b4b',
              fontSize: Math.round(disc * 0.82),
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            B
          </div>
        </div>
      </div>
    ),
    { width: icon.size, height: icon.size },
  );
}
