import { tacadaGroupOf, type TacadaGroup, type TacadaServerEventPayloads } from '@/contracts';
import type { DominoSfx } from '@/features/game/sound/sfx';
import { foulText, GROUP_LABEL } from './rules-view';
import type { ShoutTone } from './store';

/** Announcements with a sequence number (everything except state, aim and emotes). */
export type Announced = {
  [E in keyof TacadaServerEventPayloads]: TacadaServerEventPayloads[E] extends {
    seq: number;
  }
    ? { event: E; payload: TacadaServerEventPayloads[E] }
    : never;
}[keyof TacadaServerEventPayloads];

export interface Reaction {
  shout?: { text: string; tone: ShoutTone };
  /** Smaller notice that does not cover the big shout. */
  banner?: { text: string; tone: ShoutTone };
  sfx?: DominoSfx;
  /** pt-BR phrase for SpeechSynthesis. Never essential: the shout/state tells the same thing. */
  speech?: string;
}

export interface ReactionContext {
  mySeat: number;
  nameOf(seat: number): string;
  /** Groups after the shot (the state already arrived when the reaction plays). */
  groups: (TacadaGroup | null)[];
  /** Groups before the shot, to spot the table closing. */
  groupsBefore: (TacadaGroup | null)[];
}

/** How the table reacts (big text, sound, voice) to a validated server announcement. */
export function reactionFor(msg: Announced, ctx: ReactionContext): Reaction {
  const { mySeat, nameOf } = ctx;
  switch (msg.event) {
    case 'tacada:match_started': {
      const me = msg.payload.breakerSeat === mySeat;
      return { shout: { text: 'VALENDO!', tone: 'info' }, banner: { text: me ? 'Você dá a saída' : `${nameOf(msg.payload.breakerSeat)} dá a saída`, tone: 'info' }, sfx: 'domino-buy' };
    }
    case 'tacada:shot': {
      const { result } = msg.payload;
      const mine = result.seat === mySeat;
      if (result.foul) {
        const next = mine ? nameOf(1 - mySeat) : 'você';
        return { banner: { text: `Falta: ${foulText(result.foul)}! Bola na mão para ${next}`, tone: mine ? 'bad' : 'good' }, sfx: mine ? 'hand-lost' : 'domino-turn' };
      }
      if (result.eightRespotted) return { banner: { text: 'A 8 caiu na saída e voltou para a mesa', tone: 'bet' } };
      const closed = ctx.groupsBefore[result.seat] === null ? ctx.groups[result.seat] : null;
      if (closed) {
        const text = mine ? `Você fica com as ${GROUP_LABEL[closed].toLowerCase()}` : `${nameOf(result.seat)} fica com as ${GROUP_LABEL[closed].toLowerCase()}`;
        return { banner: { text, tone: mine ? 'good' : 'info' }, sfx: mine ? 'hand-won' : undefined };
      }
      const group = ctx.groups[result.seat];
      const own = group ? result.pocketed.filter((b) => tacadaGroupOf(b) === group).length : 0;
      if (own >= 2) return { shout: { text: `COMBO x${own}!`, tone: mine ? 'good' : 'bad' }, sfx: mine ? 'hand-won' : 'hand-lost', speech: mine ? 'Que tacada!' : undefined };
      return {};
    }
    case 'tacada:turn_timed_out':
      return msg.payload.seat === mySeat
        ? { banner: { text: 'Seu tempo acabou: falta!', tone: 'bad' } }
        : { banner: { text: `Tempo de ${nameOf(msg.payload.seat)} acabou: bola na mão pra você`, tone: 'good' } };
    case 'tacada:player_disconnected':
      return msg.payload.seat === mySeat ? {} : { banner: { text: `${nameOf(msg.payload.seat)} caiu. Esperando voltar…`, tone: 'info' } };
    case 'tacada:match_over':
      return msg.payload.winner === mySeat
        ? { shout: { text: 'VITÓRIA!', tone: 'good' }, sfx: 'match-won', speech: 'Ganhei!' }
        : { shout: { text: 'FIM DE JOGO', tone: 'bad' }, sfx: 'match-lost', speech: 'Não foi dessa vez.' };
    default:
      return {};
  }
}
