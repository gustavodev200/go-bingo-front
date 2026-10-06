import type { Socket } from 'socket.io-client';

type Handler = (...args: unknown[]) => void;

/** Socket.IO em memória: guarda handlers, responde acks por evento e permite disparar eventos do servidor. */
export class FakeSocket {
  private handlers = new Map<string, Handler[]>();
  readonly acks = new Map<string, unknown>();
  readonly emitted: { event: string; payload: unknown }[] = [];
  connected = false;

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  removeAllListeners() {
    this.handlers.clear();
    return this;
  }

  connect() {
    this.connected = true;
    return this;
  }

  disconnect() {
    this.connected = false;
    return this;
  }

  timeout() {
    return this;
  }

  async emitWithAck(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
    if (!this.acks.has(event)) throw new Error('operation has timed out');
    return this.acks.get(event);
  }

  /** Simula um evento vindo do servidor (ou do próprio socket, como "connect"). */
  fire(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }

  listenerCount(event: string) {
    return this.handlers.get(event)?.length ?? 0;
  }

  asSocket(): Socket {
    return this as unknown as Socket;
  }
}

/** Espera microtarefas pendentes (acks resolvidos em promises). */
export function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
