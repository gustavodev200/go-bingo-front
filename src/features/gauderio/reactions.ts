import { GAUD_CALL_LABEL, gaudManilhaName, gaudTeamOf, type GaudCall, type GaudSeat, type GaudServerEventPayloads, type GaudSideResult } from '@/contracts';
import type { TrucoSfx } from '@/features/game/sound/sfx';
import type { ShoutTone } from './store';

/** Anúncios com seq (tudo menos estado, mão privada e lista de mesas). */
export type Announced = {
  [E in keyof GaudServerEventPayloads]: GaudServerEventPayloads[E] extends { seq: number } ? { event: E; payload: GaudServerEventPayloads[E] } : never;
}[keyof GaudServerEventPayloads];

export interface Reaction {
  shout?: { text: string; tone: ShoutTone };
  banner?: { text: string; tone: ShoutTone };
  /** Envido/flor resolvido: a mesa mostra uma placa com quem marcou e por quê. */
  side?: GaudSideResult;
  sfx?: TrucoSfx;
  /** Frase para a voz (SpeechSynthesis). Nunca essencial: o grito e o estado dizem o mesmo. */
  speech?: string;
}

const SPEECH: Record<GaudCall, string> = {
  truco: 'Truco!',
  retruco: 'Quero retruco!',
  vale4: 'Quero vale quatro!',
  envido: 'Envido!',
  real_envido: 'Real envido!',
  falta_envido: 'Falta envido!',
  flor: 'Flor!',
  contraflor: 'Contra-flor!',
  contraflor_resto: 'Contra-flor e o resto!',
};

/** Como a mesa reage (grito, som, voz) a um anúncio do servidor, do ponto de vista de `mySeat`. */
export function reactionFor(msg: Announced, mySeat: GaudSeat): Reaction {
  const myTeam = gaudTeamOf(mySeat);
  switch (msg.event) {
    case 'gauderio:match_started':
      return { shout: { text: 'BOA SORTE!', tone: 'info' } };
    case 'gauderio:hand_dealt':
      return { sfx: 'card' };
    case 'gauderio:card_played': {
      const { card, seat } = msg.payload;
      if (!card || gaudManilhaName(card) !== 'Espadão') return { sfx: 'card' };
      const ours = gaudTeamOf(seat) === myTeam;
      return { shout: { text: 'ESPADÃO!', tone: ours ? 'good' : 'bad' }, sfx: 'card' };
    }
    case 'gauderio:round_ended': {
      const { result, round } = msg.payload;
      if (result === 'tie') return { banner: { text: `${round}ª rodada empatou (parda)`, tone: 'info' } };
      const ours = result === myTeam;
      return { banner: { text: `${ours ? 'Ganhamos' : 'Perdemos'} a ${round}ª rodada`, tone: ours ? 'good' : 'bad' } };
    }
    case 'gauderio:called': {
      const { call, team } = msg.payload;
      return { shout: { text: `${GAUD_CALL_LABEL[call].toUpperCase()}!`, tone: 'bet' }, sfx: 'truco', speech: team !== myTeam ? SPEECH[call] : undefined };
    }
    case 'gauderio:voted':
      // O voto em si chega só na mão privada; aqui só avisamos que o parceiro votou.
      return msg.payload.seat !== mySeat && msg.payload.team === myTeam ? { banner: { text: 'Seu parceiro votou', tone: 'info' } } : {};
    case 'gauderio:responded':
      return msg.payload.accept ? { shout: { text: 'QUERO!', tone: 'good' }, sfx: 'accept', speech: 'Quero!' } : { shout: { text: 'NÃO QUERO!', tone: 'info' }, sfx: 'run', speech: 'Não quero!' };
    case 'gauderio:side_resolved': {
      const ours = msg.payload.winnerTeam === myTeam;
      const flor = msg.payload.kind === 'flor';
      return { side: msg.payload, sfx: ours ? 'hand-won' : 'hand-lost', speech: flor && ours ? 'Flor! Essa é nossa!' : undefined };
    }
    case 'gauderio:folded':
      return msg.payload.team === myTeam ? { banner: { text: 'Fomos ao baralho', tone: 'bad' }, sfx: 'run' } : { banner: { text: 'Foram ao baralho!', tone: 'good' }, sfx: 'run' };
    case 'gauderio:hand_ended': {
      const ours = msg.payload.winnerTeam === myTeam;
      return { shout: { text: `${ours ? 'NÓS' : 'ELES'} +${msg.payload.points}`, tone: ours ? 'good' : 'bad' }, sfx: ours ? 'hand-won' : 'hand-lost' };
    }
    case 'gauderio:match_over': {
      const ours = msg.payload.winnerTeam === myTeam;
      return ours
        ? { shout: { text: 'VITÓRIA!', tone: 'good' }, sfx: 'match-won', speech: 'Ganhamos, tchê!' }
        : { shout: { text: 'DERROTA', tone: 'bad' }, sfx: 'match-lost', speech: 'Não foi dessa vez.' };
    }
    default:
      return {};
  }
}
