import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { UnoRoomScreen } from '@/features/uno/uno-room-screen';

export default async function UnoRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <UnoRoomScreen code={parsed.data} />;
}
