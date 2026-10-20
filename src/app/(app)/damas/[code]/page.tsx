import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { DamasRoomScreen } from '@/features/damas/damas-room-screen';

export default async function DamasRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <DamasRoomScreen code={parsed.data} />;
}
