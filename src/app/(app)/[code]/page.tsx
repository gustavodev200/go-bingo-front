import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { RoomScreen } from '@/features/game/room-screen';

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <RoomScreen code={parsed.data} />;
}
