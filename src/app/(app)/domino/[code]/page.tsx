import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { DominoRoomScreen } from '@/features/domino/domino-room-screen';

export default async function DominoRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <DominoRoomScreen code={parsed.data} />;
}
