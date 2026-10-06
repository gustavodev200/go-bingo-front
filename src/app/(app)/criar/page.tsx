import { CreateRoomForm } from '@/features/rooms/create-room-form';

export default function CreateRoomPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Nova sala</h1>
      <CreateRoomForm />
    </main>
  );
}
