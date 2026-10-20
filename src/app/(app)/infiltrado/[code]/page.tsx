import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { InfRoomScreen } from '@/features/infiltrado/room-screen';

export default async function InfiltradoRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <InfRoomScreen code={parsed.data} />;
}
