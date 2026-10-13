'use client';

import { UNO_COLORS, UNO_EMOTES, type UnoColor, type UnoEmote, type UnoRoomState } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { COLOR_LABEL, EMOTE_ICON, EMOTE_LABEL } from './rules-view';
import { COLOR_HEX } from './uno-card';

/** The four colors as big buttons, for a wild card. */
export function ColorPicker({ open, onPick, onClose }: { open: boolean; onPick(color: UnoColor): void; onClose(): void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Escolha a cor</DialogTitle>
          <DialogDescription>O próximo jogador terá que seguir essa cor.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {UNO_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onPick(color)}
              className="font-display flex aspect-square items-center justify-center rounded-3xl text-lg font-black text-white shadow-[0_6px_0_rgb(0_0_0/0.35)] ring-4 ring-white/80 transition outline-none hover:scale-105 focus-visible:ring-amber-300 active:translate-y-1 active:shadow-none"
              style={{ background: COLOR_HEX[color], textShadow: '0 2px 0 rgb(0 0 0 / 0.5)' }}
            >
              {COLOR_LABEL[color]}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 7-0 rule: pick whose hand to take. */
export function TargetPicker({ open, state, seats, onPick, onClose }: { open: boolean; state: UnoRoomState; seats: number[]; onPick(seat: number): void; onClose(): void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Trocar de mão com quem?</DialogTitle>
          <DialogDescription>Você fica com as cartas dessa pessoa e ela com as suas.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {seats.map((seat) => {
            const player = state.seats[seat];
            if (!player) return null;
            const count = state.round?.handCounts[seat] ?? 0;
            return (
              <li key={seat}>
                <Button variant="secondary" className="h-14 w-full justify-start gap-3 rounded-2xl" onClick={() => onPick(seat)}>
                  <Avatar id={player.userId} character={player.character} className="w-9" />
                  <span className="flex-1 truncate text-left font-bold">{player.nickname}</span>
                  <span className="text-sm tabular-nums">
                    {count} {count === 1 ? 'carta' : 'cartas'}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** Quick reactions shown over my avatar to the whole table. */
export function EmoteBar({ onSend, disabled }: { onSend(emote: UnoEmote): void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="Reações" className="flex gap-0.5 rounded-full bg-black/30 p-1 backdrop-blur">
      {UNO_EMOTES.map((emote) => (
        <button
          key={emote}
          type="button"
          disabled={disabled}
          aria-label={`Reagir: ${EMOTE_LABEL[emote]}`}
          onClick={() => onSend(emote)}
          className="flex size-9 items-center justify-center rounded-full text-lg transition hover:scale-125 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none disabled:opacity-40"
        >
          {EMOTE_ICON[emote]}
        </button>
      ))}
    </div>
  );
}
