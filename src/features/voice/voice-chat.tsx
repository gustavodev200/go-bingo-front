'use client';

import { Headphones, Loader2, Mic, MicOff, PhoneOff } from 'lucide-react';
import type { VoiceGame } from '@/contracts';
import { cn } from '@/lib/utils';
import { useVoiceChat, type VoiceChat as VoiceChatState } from './use-voice-chat';
import type { VoicePeerView } from './voice-engine';

const roundButton = 'flex size-11 items-center justify-center rounded-full border-2 shadow-lg backdrop-blur-sm transition-transform active:scale-90 disabled:opacity-60';

function initials(nickname: string) {
  return nickname.trim().slice(0, 2).toUpperCase() || '?';
}

function PeerBubble({ peer }: { peer: VoicePeerView }) {
  const state = peer.muted ? 'microfone desligado' : peer.speaking ? 'falando' : peer.connected ? 'na voz' : 'conectando';
  return (
    <li title={`${peer.nickname} — ${state}`} className="relative">
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-full border-2 bg-violet-950/80 text-xs font-bold text-white transition-shadow',
          peer.speaking ? 'border-emerald-300 shadow-[0_0_12px_3px_rgb(110_231_183/0.7)]' : 'border-violet-300/40',
          !peer.connected && 'opacity-50',
        )}
      >
        {initials(peer.nickname)}
      </span>
      {peer.muted && (
        <span aria-hidden className="absolute -right-1 -bottom-1 rounded-full bg-rose-600 p-0.5">
          <MicOff className="size-3 text-white" />
        </span>
      )}
      <span className="sr-only">
        {peer.nickname}: {state}
      </span>
    </li>
  );
}

/** Stateless panel, so it can be shown with any VoiceChat state. */
export function VoiceChatPanel({ voice }: { voice: VoiceChatState }) {
  const { view } = voice;
  if (!voice.supported) return null;

  if (view.status === 'off')
    return (
      <div className="fixed top-1/3 left-2 z-30">
        <button type="button" onClick={voice.join} aria-label="Entrar no chat de voz" title="Entrar no chat de voz" className={cn(roundButton, 'border-violet-300/50 bg-violet-950/70 text-violet-100')}>
          <Headphones aria-hidden className="size-5" />
        </button>
      </div>
    );

  const joining = view.status === 'joining';
  return (
    <section aria-label="Chat de voz" className="fixed top-1/3 left-2 z-30 flex flex-col items-center gap-2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm">
      {view.hasMic ? (
        <button
          type="button"
          disabled={joining}
          onClick={() => voice.setMuted(!view.muted)}
          aria-pressed={view.muted}
          aria-label={view.muted ? 'Ligar microfone' : 'Desligar microfone'}
          title={view.muted ? 'Ligar microfone' : 'Desligar microfone'}
          className={cn(
            roundButton,
            view.muted ? 'border-rose-300/60 bg-rose-700/80 text-white' : 'border-emerald-300/70 bg-emerald-600/80 text-white',
            view.speaking && 'shadow-[0_0_14px_4px_rgb(110_231_183/0.7)]',
          )}
        >
          {joining ? <Loader2 aria-hidden className="size-5 animate-spin" /> : view.muted ? <MicOff aria-hidden className="size-5" /> : <Mic aria-hidden className="size-5" />}
        </button>
      ) : (
        <span title="Só ouvindo (sem microfone)" className={cn(roundButton, 'border-violet-300/50 bg-violet-950/70 text-violet-100')}>
          {joining ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Headphones aria-hidden className="size-5" />}
          <span className="sr-only">Só ouvindo, sem microfone</span>
        </span>
      )}
      {view.peers.length > 0 ? (
        <ul className="flex max-h-[40dvh] flex-col items-center gap-1.5 overflow-y-auto" aria-label="Na voz">
          {view.peers.map((peer) => (
            <PeerBubble key={peer.peerId} peer={peer} />
          ))}
        </ul>
      ) : (
        !joining && <p className="max-w-11 text-center text-[10px] leading-tight text-violet-100/80">Só você</p>
      )}
      <button type="button" onClick={voice.leave} aria-label="Sair do chat de voz" title="Sair do chat de voz" className={cn(roundButton, 'size-9 border-white/20 bg-black/60 text-rose-200')}>
        <PhoneOff aria-hidden className="size-4" />
      </button>
    </section>
  );
}

/** Floating voice chat for a game room; mount it only once the player is in the room. */
export function VoiceChat({ game, code }: { game: VoiceGame; code: string }) {
  return <VoiceChatPanel voice={useVoiceChat(game, code)} />;
}
