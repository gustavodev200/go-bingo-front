import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { TrucoRoomScreen } from '@/features/truco/truco-room-screen';

export default async function TrucoRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <TrucoRoomScreen code={parsed.data} />;
}
