import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { BjRoomScreen } from '@/features/blackjack/blackjack-room-screen';

export default async function BlackjackRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <BjRoomScreen code={parsed.data} />;
}
