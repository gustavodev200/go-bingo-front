import type { DamasServerEventPayloads } from '@/contracts';
import type { DominoSfx } from '@/features/game/sound/sfx';
import type { ShoutTone } from './store';

/** Announcements with a sequence number (everything except state and emotes). */
export type Announced = {
  [E in keyof DamasServerEventPayloads]: DamasServerEventPayloads[E] extends {
    seq: number;
  }
    ? { event: E; payload: DamasServerEventPayloads[E] }
    : never;
}[keyof DamasServerEventPayloads];

export interface Reaction {
  shout?: { text: string; tone: ShoutTone };
  /** Smaller notice that does not cover the big shout. */
  banner?: { text: string; tone: ShoutTone };
  sfx?: DominoSfx;
  /** pt-BR phrase for SpeechSynthesis. Never essential: the shout/state tells the same thing. */
  speech?: string;
}

/** How the board reacts (big text, sound, voice) to a validated server announcement. */
export function reactionFor(msg: Announced, mySeat: number, nameOf: (seat: number) => string): Reaction {
  switch (msg.event) {
    case 'damas:match_started': {
      const white = msg.payload.whiteSeat === mySeat;
      return { shout: { text: 'VALENDO!', tone: 'info' }, banner: { text: white ? 'Você joga de brancas e sai primeiro' : 'Você joga de pretas', tone: 'info' }, sfx: 'domino-buy' };
    }
    case 'damas:moved': {
      const { seat, captures, promoted } = msg.payload;
      const mine = seat === mySeat;
      if (promoted) return { shout: { text: 'DAMA!', tone: mine ? 'good' : 'bad' }, sfx: mine ? 'hand-won' : 'hand-lost', speech: mine ? 'Virou dama!' : undefined };
      if (captures.length >= 2)
        return {
          shout: { text: `${captures.length} PEÇAS!`, tone: mine ? 'good' : 'bad' },
          sfx: mine ? 'hand-won' : 'hand-lost',
          speech: mine ? `Comi ${captures.length}!` : undefined,
        };
      if (captures.length === 1) return { sfx: mine ? 'hand-won' : 'domino-pass' };
      return { sfx: 'domino-clack' };
    }
    case 'damas:turn_timed_out':
      return msg.payload.seat === mySeat ? { banner: { text: 'Seu tempo acabou: lance automático', tone: 'bad' } } : { banner: { text: `Tempo de ${nameOf(msg.payload.seat)} acabou`, tone: 'info' } };
    case 'damas:draw_offered':
      return msg.payload.seat === mySeat ? { banner: { text: 'Proposta de empate enviada', tone: 'info' } } : { banner: { text: `${nameOf(msg.payload.seat)} propõe empate`, tone: 'bet' }, sfx: 'domino-turn' };
    case 'damas:draw_declined':
      return msg.payload.seat === mySeat ? {} : { banner: { text: `${nameOf(msg.payload.seat)} recusou o empate`, tone: 'info' } };
    case 'damas:player_disconnected':
      return msg.payload.seat === mySeat ? {} : { banner: { text: `${nameOf(msg.payload.seat)} caiu. Esperando voltar…`, tone: 'info' } };
    case 'damas:match_over': {
      const { winner } = msg.payload;
      if (winner === null) return { shout: { text: 'EMPATE', tone: 'info' }, sfx: 'match-lost' };
      return winner === mySeat
        ? { shout: { text: 'VITÓRIA!', tone: 'good' }, sfx: 'match-won', speech: 'Ganhei!' }
        : { shout: { text: 'FIM DE JOGO', tone: 'bad' }, sfx: 'match-lost', speech: 'Não foi dessa vez.' };
    }
    default:
      return {};
  }
}
