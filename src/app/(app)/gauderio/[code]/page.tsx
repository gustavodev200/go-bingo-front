import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { GauderioRoomScreen } from '@/features/gauderio/gauderio-room-screen';

export default async function GauderioRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <GauderioRoomScreen code={parsed.data} />;
}
