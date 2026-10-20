'use client';

import { Headphones, Loader2, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useVoiceChat, type VoiceChat } from '@/features/voice/use-voice-chat';
import { cn } from '@/lib/utils';

const VOICE_KEY = 'infiltrado.voice';
const MIC_KEY = 'infiltrado.micMuted';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
}

/**
 * Voice of one meeting: joins by itself when the meeting opens (unless the
 * player turned voice off) and, since it lives inside the meeting screen,
 * leaves when it closes. Only who can vote talks; ghosts never join.
 */
export function useMeetingVoice(code: string, canTalk: boolean): VoiceChat {
  const voice = useVoiceChat('infiltrado', code);
  const tried = useRef(false);
  const { join, supported } = voice;
  useEffect(() => {
    if (!canTalk || !supported || tried.current || read(VOICE_KEY) === 'off') return;
    tried.current = true;
    join(read(MIC_KEY) === '1');
  }, [canTalk, supported, join]);
  return voice;
}

/** Microphone, who is in the call and the way out, at the top of the meeting. */
export function MeetingVoiceBar({ voice, canTalk }: { voice: VoiceChat; canTalk: boolean }) {
  const { view } = voice;
  if (!canTalk) return <p className="text-xs text-violet-300">👻 Fantasmas não falam com os vivos: use o chat dos fantasmas.</p>;
  if (!voice.supported) return <p className="text-xs text-slate-400">Seu navegador não tem chat de voz. Use o chat de texto.</p>;

  if (view.status === 'off')
    return (
      <button
        type="button"
        onClick={() => {
          write(VOICE_KEY, 'on');
          voice.join(read(MIC_KEY) === '1');
        }}
        className="flex h-10 items-center gap-2 rounded-full border-2 border-emerald-300/70 bg-emerald-600/80 px-4 text-sm font-bold text-white"
      >
        <Headphones aria-hidden className="size-4" /> Entrar na voz
      </button>
    );

  const joining = view.status === 'joining';
  const toggleMic = () => {
    write(MIC_KEY, view.muted ? '0' : '1');
    voice.setMuted(!view.muted);
  };
  return (
    <div role="group" aria-label="Voz da reunião" className="flex items-center gap-2">
      {view.hasMic ? (
        <button
          type="button"
          disabled={joining}
          onClick={toggleMic}
          aria-pressed={view.muted}
          aria-label={view.muted ? 'Ligar microfone' : 'Desligar microfone'}
          className={cn(
            'flex h-10 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-bold text-white transition-shadow',
            view.muted ? 'border-rose-300/60 bg-rose-700/80' : 'border-emerald-300/70 bg-emerald-600/80',
            view.speaking && 'shadow-[0_0_14px_4px_rgb(110_231_183/0.7)]',
          )}
        >
          {joining ? <Loader2 aria-hidden className="size-4 animate-spin" /> : view.muted ? <MicOff aria-hidden className="size-4" /> : <Mic aria-hidden className="size-4" />}
          {joining ? 'Conectando…' : view.muted ? 'Mudo' : 'Falando'}
        </button>
      ) : (
        <span className="flex h-10 items-center gap-1.5 rounded-full border-2 border-violet-300/50 bg-violet-950/70 px-3 text-sm font-bold text-violet-100">
          {joining ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Headphones aria-hidden className="size-4" />}
          {joining ? 'Conectando…' : 'Só ouvindo'}
        </span>
      )}
      {!joining && <span className="text-xs text-slate-300">{view.peers.length === 0 ? 'Só você na voz' : `${view.peers.length + 1} na voz`}</span>}
      <button
        type="button"
        aria-label="Sair da voz"
        title="Sair da voz (nas próximas reuniões ela não liga sozinha)"
        onClick={() => {
          write(VOICE_KEY, 'off');
          voice.leave();
        }}
        className="grid size-10 place-items-center rounded-full border-2 border-white/20 bg-black/60 text-rose-200"
      >
        <PhoneOff aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/** userIds speaking right now (me included), to light up the ballot cards. */
export function speakingUsers(voice: VoiceChat, myUserId: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const p of voice.view.peers) if (p.speaking) out.add(p.userId);
  if (voice.view.speaking && myUserId) out.add(myUserId);
  return out;
}
