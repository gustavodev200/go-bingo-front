import {
  UNO_SEATS,
  type UnoCard,
  type UnoColor,
  type UnoEmote,
  type UnoPrivateHand,
  type UnoRoomState,
} from "@/contracts";

export const COLOR_NAME: Record<UnoColor, string> = {
  red: "vermelho",
  yellow: "amarelo",
  green: "verde",
  blue: "azul",
};
export const COLOR_LABEL: Record<UnoColor, string> = {
  red: "Vermelho",
  yellow: "Amarelo",
  green: "Verde",
  blue: "Azul",
};

export const EMOTE_ICON: Record<UnoEmote, string> = {
  laugh: "😂",
  shock: "😱",
  angry: "😡",
  clap: "👏",
  fire: "🔥",
  pray: "🙏",
};
export const EMOTE_LABEL: Record<UnoEmote, string> = {
  laugh: "Rindo",
  shock: "Chocado",
  angry: "Bravo",
  clap: "Palmas",
  fire: "Pegando fogo",
  pray: "Por favor",
};

/** Accessible name of a card, in Portuguese. */
export function cardLabel(card: UnoCard): string {
  if (card.value === "wild") return "Coringa";
  if (card.value === "wild4") return "Coringa +4";
  const color = COLOR_NAME[card.color as UnoColor];
  if (card.value === "skip") return `Pular ${color}`;
  if (card.value === "reverse") return `Inverter ${color}`;
  if (card.value === "draw2") return `+2 ${color}`;
  return `${card.value} ${color}`;
}

/** Other seated players in play order (direction 1), starting with the one after me. */
export function opponentsOf(state: UnoRoomState, mySeat: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < UNO_SEATS; i++) {
    const seat = (mySeat + i) % UNO_SEATS;
    if (state.seats[seat]) out.push(seat);
  }
  return out;
}

/**
 * Where the `index`-th of `count` opponents sits, in % of the table: an arc
 * from the left edge, over the top, to the right edge (I am at the bottom).
 */
export function placementOf(
  index: number,
  count: number,
): { left: number; top: number } {
  if (count <= 1) return { left: 50, top: 6 };
  const from = 168;
  const to = 12;
  const angle = ((from + ((to - from) * index) / (count - 1)) * Math.PI) / 180;
  return {
    left: Math.round(50 + 44 * Math.cos(angle)),
    top: Math.round(48 - 42 * Math.sin(angle)),
  };
}

export interface UnoAvailable {
  myTurn: boolean;
  /** Card ids I may play now (from the server). */
  playable: ReadonlySet<string>;
  canDraw: boolean;
  /** I drew a playable card: keep it and end the turn. */
  canPass: boolean;
  canChallenge: boolean;
  /** Cards I must draw unless I stack or challenge (0 when none). */
  pendingDraw: number;
  canCallUno: boolean;
  canCatch: boolean;
}

const NONE: UnoAvailable = {
  myTurn: false,
  playable: new Set(),
  canDraw: false,
  canPass: false,
  canChallenge: false,
  pendingDraw: 0,
  canCallUno: false,
  canCatch: false,
};

/** What the player can do right now (the server validates again). */
export function availableActions(
  state: UnoRoomState,
  hand: UnoPrivateHand | null,
  mySeat: number,
): UnoAvailable {
  const round = state.round;
  if (state.phase !== "PLAYING" || !round || round.phase !== "PLAYING")
    return NONE;
  const myTurn = round.turn === mySeat;
  const playable = new Set(myTurn ? (hand?.playable ?? []) : []);
  const count = hand?.cards.length ?? 0;
  return {
    myTurn,
    playable,
    canDraw: myTurn && !round.awaitingDrawn,
    canPass: myTurn && round.awaitingDrawn,
    canChallenge: myTurn && round.canChallenge,
    pendingDraw: myTurn ? round.pendingDraw : 0,
    canCallUno:
      !round.saidUno[mySeat] &&
      (count === 1 || (count === 2 && myTurn && playable.size > 0)),
    canCatch: round.unoExposed !== null && round.unoExposed !== mySeat,
  };
}

export const TARGET_LABEL: Record<number, string> = {
  0: "Rodada única",
  200: "Corrida dos 200",
  500: "Corrida dos 500",
};
