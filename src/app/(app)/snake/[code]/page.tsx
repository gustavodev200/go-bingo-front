import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { SnakeRoomScreen } from '@/features/snake/snake-screen';

export default async function SnakeRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <SnakeRoomScreen code={parsed.data} />;
}
