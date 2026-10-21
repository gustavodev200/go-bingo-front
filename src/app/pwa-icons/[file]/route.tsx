import { ImageResponse } from 'next/og';
import { PWA_ICONS, findIcon } from '@/lib/pwa/icons';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return PWA_ICONS.map(({ file }) => ({ file }));
}

// Mesma marca do GoPlayersMark: bola dourada com "GO" e três bolinhas (os jogos) em órbita.
const ORBIT = [
  { color: '#2563eb', angle: -150 },
  { color: '#db2777', angle: -30 },
  { color: '#16a34a', angle: 90 },
] as const;

// Diâmetro da bola central relativo ao ícone. Maskable fica menor para caber na safe zone (círculo de 80%).
function ballRatio({ maskable, transparent }: { maskable: boolean; transparent?: boolean }) {
  if (transparent) return 0.6;
  return maskable ? 0.44 : 0.56;
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const icon = findIcon((await params).file);
  if (!icon) return new Response('Not found', { status: 404 });
  const center = icon.size / 2;
  const ball = Math.round(icon.size * ballRatio(icon));
  const disc = Math.round(ball * 0.6);
  const small = Math.round(ball * 0.34);
  const orbit = ball * 0.62;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
          background: icon.transparent ? 'transparent' : 'linear-gradient(160deg, #6d28d9 0%, #4c1d95 55%, #2e1065 100%)',
        }}
      >
        {ORBIT.map(({ color, angle }) => (
          <div
            key={color}
            style={{
              position: 'absolute',
              left: Math.round(center + orbit * Math.cos((angle * Math.PI) / 180) - small / 2),
              top: Math.round(center + orbit * Math.sin((angle * Math.PI) / 180) - small / 2),
              width: small,
              height: small,
              borderRadius: '50%',
              background: color,
              border: `${Math.max(1, Math.round(small * 0.1))}px solid rgba(255,255,255,0.7)`,
            }}
          />
        ))}
        <div
          style={{
            width: ball,
            height: ball,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: 'radial-gradient(circle at 35% 30%, #fef9c3 0%, #fbbf24 45%, #b45309 100%)',
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
              color: '#4c1d95',
              fontSize: Math.round(disc * 0.55),
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            GO
          </div>
        </div>
      </div>
    ),
    { width: icon.size, height: icon.size },
  );
}
