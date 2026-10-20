import type { BjServerEventPayloads } from '@/contracts';
import type { Sfx } from '@/features/game/sound/sfx';
import type { ShoutTone } from './store';

/** Announcements with a sequence number (everything except state and emotes). */
export type Announced = {
  [E in keyof BjServerEventPayloads]: BjServerEventPayloads[E] extends {
    seq: number;
  }
    ? { event: E; payload: BjServerEventPayloads[E] }
    : never;
}[keyof BjServerEventPayloads];

export interface Reaction {
  shout?: { text: string; tone: ShoutTone };
  /** Smaller notice that does not cover the big shout. */
  banner?: { text: string; tone: ShoutTone };
  sfx?: Sfx;
  /** pt-BR phrase for SpeechSynthesis. Never essential: the shout/state tells the same thing. */
  speech?: string;
}

const chips = (n: number) => `${n} ${Math.abs(n) === 1 ? 'ficha' : 'fichas'}`;

/** How the table reacts (big text, sound, voice) to a validated server announcement. */
export function reactionFor(msg: Announced, mySeat: number, nameOf: (seat: number) => string): Reaction {
  switch (msg.event) {
    case 'blackjack:match_started':
      return { shout: { text: 'VALENDO!', tone: 'info' }, banner: { text: `${msg.payload.rounds} rodadas: termine com mais fichas`, tone: 'info' }, sfx: 'domino-buy' };
    case 'blackjack:round_started':
      return { banner: { text: `Rodada ${msg.payload.round}: façam suas apostas`, tone: 'bet' }, sfx: 'domino-turn' };
    case 'blackjack:shuffled':
      return { banner: { text: 'Embaralhando o sapato', tone: 'info' }, sfx: 'uno-wild' };
    case 'blackjack:dealt': {
      const { blackjacks, insurance } = msg.payload;
      if (blackjacks.includes(mySeat)) return { shout: { text: 'BLACKJACK!', tone: 'good' }, sfx: 'hand-won', speech: 'Blackjack!' };
      if (insurance) return { banner: { text: 'O dealer mostra um Ás: quer seguro?', tone: 'bet' }, sfx: 'card' };
      if (blackjacks.length > 0) return { banner: { text: `Blackjack de ${nameOf(blackjacks[0])}!`, tone: 'info' }, sfx: 'card' };
      return { sfx: 'card' };
    }
    case 'blackjack:acted': {
      const { seat, action, status, total, auto } = msg.payload;
      const mine = seat === mySeat;
      if (status === 'bust')
        return mine ? { shout: { text: 'ESTOUROU!', tone: 'bad' }, sfx: 'hand-lost', speech: 'Estourei.' } : { banner: { text: `${nameOf(seat)} estourou com ${total}`, tone: 'info' }, sfx: 'card' };
      if (auto && mine) return { banner: { text: 'Seu tempo acabou: a mão parou', tone: 'bad' } };
      if (action === 'split') return { banner: { text: mine ? 'Mão dividida em duas' : `${nameOf(seat)} dividiu`, tone: 'bet' }, sfx: 'card' };
      if (action === 'double') return { banner: { text: mine ? `Dobrou! Fez ${total}` : `${nameOf(seat)} dobrou`, tone: 'bet' }, sfx: 'card' };
      if (action === 'surrender') return { banner: { text: mine ? 'Você rendeu: metade de volta' : `${nameOf(seat)} rendeu`, tone: 'info' }, sfx: 'domino-pass' };
      if (action === 'hit') return { sfx: 'card' };
      return {};
    }
    case 'blackjack:dealer_played': {
      const { blackjack, bust, total } = msg.payload;
      if (blackjack) return { shout: { text: 'BLACKJACK DO DEALER', tone: 'bad' }, sfx: 'hand-lost' };
      if (bust) return { shout: { text: 'DEALER ESTOUROU!', tone: 'good' }, sfx: 'hand-won', speech: 'O dealer estourou!' };
      return { banner: { text: `Dealer fez ${total}`, tone: 'info' } };
    }
    case 'blackjack:round_settled': {
      const mine = msg.payload.nets.find((n) => n.seat === mySeat);
      if (!mine) return {};
      if (mine.net > 0) return { banner: { text: `+${chips(mine.net)}`, tone: 'good' }, sfx: 'hand-won' };
      if (mine.net < 0) return { banner: { text: `−${chips(-mine.net)}`, tone: 'bad' }, sfx: 'hand-lost' };
      return { banner: { text: 'Empate: aposta de volta', tone: 'info' } };
    }
    case 'blackjack:player_broke':
      return msg.payload.seat === mySeat
        ? { banner: { text: 'Você ficou sem fichas. Assista até o fim', tone: 'bad' } }
        : { banner: { text: `${nameOf(msg.payload.seat)} ficou sem fichas`, tone: 'info' } };
    case 'blackjack:player_disconnected':
      return msg.payload.seat === mySeat ? {} : { banner: { text: `${nameOf(msg.payload.seat)} caiu. Esperando voltar…`, tone: 'info' } };
    case 'blackjack:match_over': {
      const me = msg.payload.standings.find((s) => s.seat === mySeat);
      if (msg.payload.standings.length === 1) return { shout: { text: 'FIM DO TREINO', tone: 'info' }, sfx: 'match-won' };
      if (me && me.placement === 1 && !me.left) return { shout: { text: 'VITÓRIA!', tone: 'good' }, sfx: 'match-won', speech: 'Ganhei!' };
      return { shout: { text: 'FIM DE JOGO', tone: 'bad' }, sfx: 'match-lost', speech: 'Não foi dessa vez.' };
    }
    default:
      return {};
  }
}
