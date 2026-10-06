import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientAckData } from '@/contracts';
import { env } from '@/lib/env';
import { getAccessToken } from '@/lib/session';

const ACK_TIMEOUT_MS = 5_000;

export function createGameSocket(): Socket {
  return io(`${env.NEXT_PUBLIC_API_URL}/game`, {
    autoConnect: false,
    transports: ['websocket'],
    // Função: o token é relido a cada reconexão (o Supabase renova o access token).
    auth: (cb) => {
      void getAccessToken().then((token) => cb({ token }));
    },
  });
}

export async function emitAck<E extends keyof ClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<ClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<ClientAckData[E]>;
  } catch {
    return { ok: false, error: { code: 'INTERNAL', message: 'Sem resposta do servidor' } };
  }
}
