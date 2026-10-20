import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { TacadaRoomScreen } from '@/features/tacada/tacada-room-screen';

export default async function TacadaRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <TacadaRoomScreen code={parsed.data} />;
}
