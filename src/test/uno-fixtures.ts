import type {
  UnoCard,
  UnoPrivateHand,
  UnoRoomState,
  UnoRoundView,
  UnoSeatPlayer,
} from "@/contracts";

export const NAMES = ["Ana", "Bia", "Caio", "Duda", "Edu", "Fê"];
export const userId = (seat: number) =>
  `00000000-0000-4000-8000-00000000000${seat + 1}`;

export function seatPlayer(
  seat: number,
  over: Partial<UnoSeatPlayer> = {},
): UnoSeatPlayer {
  return {
    seat,
    userId: userId(seat),
    nickname: NAMES[seat],
    character: null,
    ready: false,
    connected: true,
    reconnectDeadline: null,
    ...over,
  };
}

export function roundView(over: Partial<UnoRoundView> = {}): UnoRoundView {
  return {
    roundNumber: 1,
    phase: "PLAYING",
    turn: 0,
    direction: 1,
    topCard: { color: "red", value: "5" },
    color: "red",
    drawPile: 80,
    discardCount: 1,
    handCounts: [7, 7, 7, 0, 0, 0],
    pendingDraw: 0,
    canChallenge: false,
    awaitingDrawn: false,
    saidUno: [false, false, false, false, false, false],
    unoExposed: null,
    lastRound: null,
    turnDeadline: null,
    ...over,
  };
}

export function roomState(over: Partial<UnoRoomState> = {}): UnoRoomState {
  return {
    code: "ABC234",
    version: 1,
    hostId: userId(0),
    isPublic: true,
    rules: { target: 0, stacking: false, sevenZero: false },
    phase: "PLAYING",
    lobbyStatus: null,
    seats: [seatPlayer(0), seatPlayer(1), seatPlayer(2), null, null, null],
    scores: [0, 0, 0, 0, 0, 0],
    round: roundView(),
    result: null,
    ...over,
  };
}

export const c = (
  color: UnoCard["color"],
  value: UnoCard["value"],
): UnoCard => ({ color, value });

export function privateHand(
  over: Partial<UnoPrivateHand> = {},
): UnoPrivateHand {
  return {
    roundNumber: 1,
    cards: [
      { id: "r1c0", card: c("red", "3") },
      { id: "r1c1", card: c("blue", "7") },
      { id: "r1c2", card: c("wild", "wild") },
    ],
    playable: ["r1c0", "r1c2"],
    drawnCardId: null,
    ...over,
  };
}
