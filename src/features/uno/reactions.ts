import type { UnoServerEventPayloads } from "@/contracts";
import type { UnoSfx } from "@/features/game/sound/sfx";
import type { ShoutTone } from "./store";

/** Announcements with a sequence number (everything except state, hands and emotes). */
export type Announced = {
  [E in keyof UnoServerEventPayloads]: UnoServerEventPayloads[E] extends {
    seq: number;
  }
    ? { event: E; payload: UnoServerEventPayloads[E] }
    : never;
}[keyof UnoServerEventPayloads];

export interface Reaction {
  shout?: { text: string; tone: ShoutTone };
  /** Smaller notice that does not cover the big shout. */
  banner?: { text: string; tone: ShoutTone };
  sfx?: UnoSfx;
  /** pt-BR phrase for SpeechSynthesis. Never essential: the shout/state tells the same thing. */
  speech?: string;
}

/** How the table reacts (big text, sound, voice) to a validated server announcement. */
export function reactionFor(
  msg: Announced,
  mySeat: number,
  nameOf: (seat: number) => string,
): Reaction {
  switch (msg.event) {
    case "uno:match_started":
      return { shout: { text: "BOA SORTE!", tone: "info" }, sfx: "uno-wild" };
    case "uno:round_started":
      return msg.payload.roundNumber > 1
        ? {
            banner: { text: `Rodada ${msg.payload.roundNumber}`, tone: "info" },
            sfx: "card",
          }
        : { sfx: "card" };
    case "uno:card_played": {
      const { card, seat } = msg.payload;
      if (card.value === "wild4")
        return {
          shout: { text: "+4!", tone: "bet" },
          sfx: "uno-wild",
          speech: seat === mySeat ? undefined : "Compra quatro!",
        };
      if (card.value === "draw2")
        return { shout: { text: "+2!", tone: "bet" }, sfx: "uno-skip" };
      if (card.value === "skip")
        return { shout: { text: "PULOU!", tone: "info" }, sfx: "uno-skip" };
      if (card.value === "reverse")
        return { shout: { text: "INVERTEU!", tone: "info" }, sfx: "uno-skip" };
      if (card.value === "wild") return { sfx: "uno-wild" };
      return { sfx: "card" };
    }
    case "uno:cards_drawn": {
      const { seat, count, reason } = msg.payload;
      if (
        seat === mySeat &&
        count > 0 &&
        reason !== "choice" &&
        reason !== "timeout"
      )
        return {
          banner: { text: `Você comprou ${count}`, tone: "bad" },
          sfx: "uno-draw",
        };
      return count > 0 ? { sfx: "uno-draw" } : {};
    }
    case "uno:turn_skipped":
      return msg.payload.seat === mySeat
        ? { banner: { text: "Você perdeu a vez!", tone: "bad" } }
        : {};
    case "uno:turn_timed_out":
      return msg.payload.seat === mySeat
        ? { banner: { text: "Seu tempo acabou", tone: "bad" } }
        : {};
    case "uno:challenge_resolved":
      return msg.payload.bluffed
        ? {
            shout: { text: "BLEFE!", tone: "bet" },
            sfx: "uno-caught",
            speech: "Era blefe!",
          }
        : {
            shout: { text: "LIMPO!", tone: "info" },
            sfx: "run",
            speech: "Desafio errado, compra seis!",
          };
    case "uno:uno_called":
      return {
        shout: { text: "UNO!", tone: "bet" },
        sfx: "uno-call",
        speech: "UNO!",
      };
    case "uno:uno_caught": {
      const mine = msg.payload.seat === mySeat;
      return {
        shout: { text: mine ? "PEGO!" : "PEGOU!", tone: mine ? "bad" : "good" },
        sfx: "uno-caught",
        speech: "Pegou! Compra duas!",
      };
    }
    case "uno:hands_swapped":
    case "uno:hands_rotated":
      return { shout: { text: "TROCA!", tone: "info" }, sfx: "uno-wild" };
    case "uno:direction_changed":
      return {};
    case "uno:round_ended": {
      const { winner, points } = msg.payload;
      if (winner === mySeat)
        return {
          shout: { text: `BATEU! +${points}`, tone: "good" },
          sfx: "hand-won",
          speech: "Bati!",
        };
      return {
        banner: { text: `${nameOf(winner)} bateu! +${points}`, tone: "bad" },
        sfx: "hand-lost",
      };
    }
    case "uno:match_over":
      return msg.payload.winner === mySeat
        ? {
            shout: { text: "VITÓRIA!", tone: "good" },
            sfx: "match-won",
            speech: "Ganhei! Ninguém segura!",
          }
        : {
            shout: { text: "FIM DE JOGO", tone: "bad" },
            sfx: "match-lost",
            speech: "Não foi dessa vez.",
          };
    default:
      return {};
  }
}
