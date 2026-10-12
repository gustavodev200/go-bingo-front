import { manilhaName, teamOf, type Seat, type TrucoServerEventPayloads } from '@/contracts';
import type { TrucoSfx } from '@/features/game/sound/sfx';
import type { ShoutTone } from './store';

/** Announcements with a sequence number (everything except state, hands and signals). */
export type Announced = {
  [E in keyof TrucoServerEventPayloads]: TrucoServerEventPayloads[E] extends { seq: number } ? { event: E; payload: TrucoServerEventPayloads[E] } : never;
}[keyof TrucoServerEventPayloads];

export interface Reaction {
  shout?: { text: string; tone: ShoutTone };
  /** Smaller notice that does not cover the big shout (round results). */
  banner?: { text: string; tone: ShoutTone };
  sfx?: TrucoSfx;
  /** pt-BR phrase for SpeechSynthesis. Never essential: the shout/state always tells the same thing. */
  speech?: string;
}

const BET_SHOUT: Record<number, [string, string]> = {
  3: ['TRUCO!', 'TRUUUCO!'],
  6: ['SEIS!', 'Seis!'],
  9: ['NOVE!', 'Vale nove!'],
  12: ['DOZE!', 'Vale doze!'],
};

/** How the table reacts (big text, sound, voice) to a validated server announcement. */
export function reactionFor(msg: Announced, mySeat: Seat): Reaction {
  const myTeam = teamOf(mySeat);
  switch (msg.event) {
    case 'truco:match_started':
      return { shout: { text: 'BOA SORTE!', tone: 'info' } };
    case 'truco:hand_dealt':
      if (msg.payload.kind === 'iron') return { shout: { text: 'MÃO DE FERRO!', tone: 'bet' }, sfx: 'truco', speech: 'Mão de ferro!' };
      if (msg.payload.kind === 'ten') return { shout: { text: 'MÃO DE DEZ!', tone: 'bet' }, sfx: 'truco', speech: 'Mão de dez!' };
      return { sfx: 'card' };
    case 'truco:card_played': {
      if (manilhaName(msg.payload.card) !== 'Zap') return { sfx: 'card' };
      const ours = teamOf(msg.payload.seat) === myTeam;
      return { shout: { text: 'ZAP!', tone: ours ? 'good' : 'bad' }, sfx: 'card', speech: ours ? 'É ZAP, meu parceiro!' : undefined };
    }
    case 'truco:round_ended': {
      const { result, round } = msg.payload;
      if (result === 'tie') return { banner: { text: `${round}ª rodada empatou`, tone: 'info' } };
      const ours = result === myTeam;
      return { banner: { text: `Vocês ${ours ? 'ganharam' : 'perderam'} a ${round}ª rodada`, tone: ours ? 'good' : 'bad' } };
    }
    case 'truco:bet_requested': {
      const [text, speech] = BET_SHOUT[msg.payload.value] ?? ['TRUCO!', 'Truco!'];
      const againstUs = msg.payload.team !== myTeam;
      return { shout: { text, tone: 'bet' }, sfx: 'truco', speech: againstUs ? `${speech} Corre ou aceita!` : speech };
    }
    case 'truco:bet_resolved':
      return msg.payload.response === 'accept' ? { shout: { text: 'ACEITO!', tone: 'good' }, sfx: 'accept', speech: 'Aceito!' } : { shout: { text: 'CORREU!', tone: 'info' }, sfx: 'run', speech: 'Correu!' };
    case 'truco:ten_decided':
      return msg.payload.play ? { shout: { text: 'VAI PRO JOGO!', tone: 'bet' } } : { shout: { text: 'CORREU!', tone: 'info' }, sfx: 'run' };
    case 'truco:hand_ended': {
      const { winnerTeam, points } = msg.payload;
      if (winnerTeam === null) return { shout: { text: 'EMPATOU!', tone: 'info' } };
      const ours = winnerTeam === myTeam;
      return {
        shout: { text: `${ours ? 'NÓS' : 'ELES'} +${points}`, tone: ours ? 'good' : 'bad' },
        sfx: ours ? 'hand-won' : 'hand-lost',
        speech: ours && points >= 4 ? 'Essa mão é nossa!' : undefined,
      };
    }
    case 'truco:match_over': {
      const ours = msg.payload.winnerTeam === myTeam;
      return ours
        ? { shout: { text: 'VITÓRIA!', tone: 'good' }, sfx: 'match-won', speech: 'Ganhamos! Essa é nossa!' }
        : { shout: { text: 'DERROTA', tone: 'bad' }, sfx: 'match-lost', speech: 'Não foi dessa vez.' };
    }
    default:
      return {};
  }
}
