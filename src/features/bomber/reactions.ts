import { BOMBER_CURSE_LABEL, BOMBER_ITEM_NAMES, BOMBER_ITEMS, type BomberFrame, type BomberRoomState } from '@/contracts';
import type { BomberAnnouncement } from './connection';
import type { BomberSfx } from './media/audio';

export type BannerTone = 'info' | 'go' | 'hurry' | 'win' | 'lose';

export interface Banner {
  text: string;
  sub?: string;
  tone: BannerTone;
  /** How long it stays up (ms); 0 = until replaced. */
  ms: number;
}

export interface Reaction {
  sfx: BomberSfx[];
  /** Screen shake strength to add. */
  shake: number;
  toast?: string;
  banner?: Banner;
  vibrate?: number[];
  musicFast?: boolean;
}

const SIMPLE_SFX: Partial<Record<string, BomberSfx>> = { place: 'place', kick: 'kick', throw: 'throw', pick: 'pick', land: 'land', thud: 'thud' };

/** What one arena frame should sound and look like for the player at `mySeat`. */
export function reactToFrame(frame: BomberFrame, mySeat: number): Reaction {
  const out: Reaction = { sfx: [], shake: 0 };
  for (const e of frame.events) {
    const simple = SIMPLE_SFX[e.k];
    if (simple) {
      out.sfx.push(simple);
      continue;
    }
    switch (e.k) {
      case 'boom':
        out.sfx.push('boom');
        out.shake += 1.5;
        break;
      case 'go':
        out.sfx.push('go');
        out.banner = { text: 'VAI!', tone: 'go', ms: 700 };
        break;
      case 'hurry':
        out.sfx.push('hurry');
        out.banner = { text: 'PRESSA!', tone: 'hurry', ms: 1500 };
        out.musicFast = true;
        break;
      case 'die':
        out.sfx.push('die');
        if (e.seat === mySeat) out.vibrate = [60, 40, 120];
        break;
      case 'item':
        if (e.seat !== mySeat) break;
        if (e.c === BOMBER_ITEMS.SKULL) {
          out.sfx.push('skull');
          out.toast = `☠ ${e.curse ? BOMBER_CURSE_LABEL[e.curse] : 'Amaldiçoado!'}`;
        } else {
          out.sfx.push('item');
          out.toast = BOMBER_ITEM_NAMES[e.c];
        }
        break;
    }
  }
  return out;
}

const nameOf = (state: BomberRoomState | null, seat: number) => state?.seats[seat]?.nickname ?? 'Alguém';

/** Banners and sounds for room announcements (round start/end, champion). */
export function reactToAnnouncement(msg: BomberAnnouncement, state: BomberRoomState | null, mySeat: number): Reaction {
  switch (msg.event) {
    case 'bomber:round_started':
      return { sfx: [], shake: 0, musicFast: false, banner: { text: `RODADA ${msg.payload.roundNumber}`, tone: 'info', ms: 1300 } };
    case 'bomber:round_ended': {
      const { winner, wins } = msg.payload;
      if (winner === null) return { sfx: ['draw'], shake: 0, banner: { text: 'EMPATE!', tone: 'lose', ms: 3000 } };
      const goal = state?.rules.winsToWin ?? 3;
      const text = winner === mySeat ? 'VOCÊ VENCEU!' : `${nameOf(state, winner).toUpperCase()} VENCEU!`;
      return { sfx: ['win'], shake: 0, banner: { text, sub: `🏆 ${wins[winner]} / ${goal}`, tone: winner === mySeat ? 'win' : 'info', ms: 3000 } };
    }
    case 'bomber:match_over':
      return { sfx: ['win'], shake: 0 };
    default:
      return { sfx: [], shake: 0 };
  }
}
