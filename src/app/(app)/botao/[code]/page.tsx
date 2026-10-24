import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { BotaoRoomScreen } from '@/features/botao/room-screen';

export default async function BotaoRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <BotaoRoomScreen code={parsed.data} />;
}
