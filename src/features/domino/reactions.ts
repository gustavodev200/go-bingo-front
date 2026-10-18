import type { DominoServerEventPayloads } from '@/contracts';
import type { DominoSfx } from '@/features/game/sound/sfx';
import type { ShoutTone } from './store';

/** Announcements with a sequence number (everything except state, hands and emotes). */
export type Announced = {
  [E in keyof DominoServerEventPayloads]: DominoServerEventPayloads[E] extends {
    seq: number;
  }
    ? { event: E; payload: DominoServerEventPayloads[E] }
    : never;
}[keyof DominoServerEventPayloads];

export interface Reaction {
  shout?: { text: string; tone: ShoutTone };
  /** Smaller notice that does not cover the big shout. */
  banner?: { text: string; tone: ShoutTone };
  sfx?: DominoSfx;
  /** pt-BR phrase for SpeechSynthesis. Never essential: the shout/state tells the same thing. */
  speech?: string;
}

/**
 * How the table reacts (big text, sound, voice) to a validated server announcement.
 * `mine(seats)` tells whether my side (me, or me and my partner) is among the seats.
 */
export function reactionFor(msg: Announced, mySeat: number, nameOf: (seat: number) => string, mine: (seats: number[]) => boolean): Reaction {
  switch (msg.event) {
    case 'domino:match_started':
      return { shout: { text: 'BOA SORTE!', tone: 'info' }, sfx: 'domino-buy' };
    case 'domino:round_started': {
      const { roundNumber, starter } = msg.payload;
      const who = starter === mySeat ? 'Você sai' : `${nameOf(starter)} sai`;
      return { banner: { text: roundNumber > 1 ? `Rodada ${roundNumber} · ${who}` : who, tone: 'info' }, sfx: 'domino-buy' };
    }
    case 'domino:tile_played': {
      const { tile, tilesLeft, seat } = msg.payload;
      if (tilesLeft === 1 && seat !== mySeat) return { banner: { text: `${nameOf(seat)} está com 1 peça!`, tone: 'bet' }, sfx: 'domino-clack' };
      if (tile.a === tile.b && tile.a === 6) return { shout: { text: 'CARROÇA!', tone: 'bet' }, sfx: 'domino-clack', speech: 'Carroça de sena!' };
      return { sfx: 'domino-clack' };
    }
    case 'domino:tiles_drawn': {
      const { seat, count } = msg.payload;
      if (count === 0) return {};
      const text = seat === mySeat ? `Você comprou ${count}` : `${nameOf(seat)} comprou ${count}`;
      return { banner: { text, tone: seat === mySeat ? 'bad' : 'info' }, sfx: 'domino-buy' };
    }
    case 'domino:turn_passed':
      return msg.payload.seat === mySeat
        ? { banner: { text: 'Você passou: nenhuma peça serve', tone: 'bad' }, sfx: 'domino-pass' }
        : { banner: { text: `${nameOf(msg.payload.seat)} passou`, tone: 'info' }, sfx: 'domino-pass', speech: 'Passou!' };
    case 'domino:turn_timed_out':
      return msg.payload.seat === mySeat ? { banner: { text: 'Seu tempo acabou', tone: 'bad' } } : {};
    case 'domino:round_ended': {
      const { winners, points, blocked } = msg.payload;
      if (winners.length === 0) return { shout: { text: 'EMPATE!', tone: 'info' }, sfx: 'hand-lost', speech: 'Trancou! Empatou.' };
      if (mine(winners))
        return {
          shout: { text: blocked ? `TRANCOU! +${points}` : `BATEU! +${points}`, tone: 'good' },
          sfx: 'hand-won',
          speech: blocked ? 'Trancou e ganhou!' : 'Bati!',
        };
      return {
        banner: { text: `${nameOf(winners[0])} ${blocked ? 'ganhou no trancado' : 'bateu'}! +${points}`, tone: 'bad' },
        sfx: 'hand-lost',
        speech: blocked ? 'Trancou!' : undefined,
      };
    }
    case 'domino:match_over': {
      const { winners } = msg.payload;
      if (winners.length === 0) return { shout: { text: 'EMPATE', tone: 'info' }, sfx: 'match-lost' };
      return mine(winners)
        ? { shout: { text: 'VITÓRIA!', tone: 'good' }, sfx: 'match-won', speech: 'Ganhei! Ninguém segura!' }
        : { shout: { text: 'FIM DE JOGO', tone: 'bad' }, sfx: 'match-lost', speech: 'Não foi dessa vez.' };
    }
    default:
      return {};
  }
}
