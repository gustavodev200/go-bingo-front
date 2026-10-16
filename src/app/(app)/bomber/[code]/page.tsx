import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { BomberRoomScreen } from '@/features/bomber/room-screen';

export default async function BomberRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <BomberRoomScreen code={parsed.data} />;
}
