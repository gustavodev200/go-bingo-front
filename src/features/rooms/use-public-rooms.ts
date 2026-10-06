'use client';

import { useEffect, useState } from 'react';
import { ServerEvents, type PublicRoom } from '@/contracts';
import { createGameSocket, emitAck } from '@/lib/socket';

export function usePublicRooms(): PublicRoom[] | null {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);

  useEffect(() => {
    const socket = createGameSocket();
    socket.on('connect', () => {
      void emitAck(socket, 'rooms:watch').then((res) => res.ok && setRooms(res.data));
    });
    socket.on(ServerEvents.ROOMS_UPDATED, (payload: { rooms: PublicRoom[] }) => setRooms(payload.rooms));
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  return rooms;
}
