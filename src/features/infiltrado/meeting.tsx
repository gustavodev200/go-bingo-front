'use client';

import { Check, MessageCircle, Send, SkipForward, Users, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { INF_CHAT_MAX, INF_COLORS, type InfFrame, type InfRoomState } from '@/contracts';
import { cn } from '@/lib/utils';
import type { InfActions } from './connection';
import { DiverIcon } from './diver-icon';
import { MeetingVoiceBar, speakingUsers, useMeetingVoice } from './meeting-voice';
import { sfx } from './media/audio';
import { useInfStore } from './store';

const STAGE_LABEL = { talk: 'Discussão', vote: 'Votação', result: 'Resultado' } as const;

function Chat({ state, frame, actions, active }: { state: InfRoomState; frame: InfFrame; actions: InfActions; active: boolean }) {
  const chat = useInfStore((s) => s.chat);
  const markRead = useInfStore((s) => s.markRead);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const ghost = !frame.me.alive;

  useEffect(() => {
    if (active) markRead();
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, active, markRead]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const ok = await actions.chat(t);
    setSending(false);
    if (ok) setText('');
  }

  return (
    <section aria-label="Chat da reunião" className="flex min-h-0 flex-1 flex-col gap-2">
      <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl bg-slate-950/60 p-2" aria-live="polite">
        {chat.length === 0 && <li className="m-auto text-center text-sm text-slate-400">{ghost ? 'Fantasmas só conversam entre si.' : 'Diga o que viu, onde estava e de quem desconfia.'}</li>}
        {chat.map((m) => {
          const seat = state.seats[m.seat];
          const color = INF_COLORS[seat?.color ?? 0];
          return (
            <li key={m.id} className={cn('flex items-start gap-2 rounded-lg px-2 py-1', m.ghost ? 'bg-violet-900/40 italic' : 'bg-white/5')}>
              <DiverIcon color={seat?.color ?? 0} ghost={m.ghost} className="size-7 shrink-0" />
              <p className="min-w-0 text-sm leading-snug break-words">
                <b style={{ color: color.body }}>{seat?.nickname ?? '?'}</b>
                {m.ghost && <span className="text-violet-300"> (fantasma)</span>}: <span className="text-slate-100">{m.text}</span>
              </p>
            </li>
          );
        })}
      </ol>
      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={INF_CHAT_MAX}
          placeholder={ghost ? 'Falar com os fantasmas…' : 'Escreva…'}
          aria-label="Mensagem"
          enterKeyHint="send"
          className="h-11 min-w-0 flex-1 rounded-xl border-2 border-slate-600 bg-slate-900 px-3 text-base text-white outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          aria-label="Enviar"
          disabled={sending || !text.trim()}
          className="grid size-11 place-items-center rounded-xl border-2 border-black bg-cyan-400 text-slate-950 disabled:opacity-50"
        >
          <Send aria-hidden className="size-5" />
        </button>
      </form>
    </section>
  );
}

/** The emergency meeting: who called it, the ballot, the chat and the reveal of the votes. */
export function MeetingOverlay({ state, mySeat, frame, actions }: { state: InfRoomState; mySeat: number; frame: InfFrame; actions: InfActions }) {
  const m = frame.meeting!;
  const [pickedRaw, setPicked] = useState<number | null>(null);
  const [tab, setTab] = useState<'vote' | 'chat'>('vote');
  const unread = useInfStore((s) => s.unread);
  const canTalk = m.voters.includes(mySeat);
  const voice = useMeetingVoice(state.code, canTalk);
  const speaking = speakingUsers(voice, state.seats[mySeat]?.userId);
  const canVote = m.stage === 'vote' && m.voters.includes(mySeat) && !m.voted.includes(mySeat);
  const name = (seat: number) => state.seats[seat]?.nickname ?? 'Alguém';
  const players = state.seats.flatMap((s, seat) => (s ? [{ ...s, seat }] : []));
  const votesFor = (target: number) => (m.votes ?? []).filter(([, t]) => t === target).map(([v]) => v);

  const picked = canVote ? pickedRaw : null;

  const vote = async (target: number) => {
    sfx('vote');
    setPicked(null);
    await actions.act({ t: 'vote', target });
  };

  const ballot = (
    <section aria-label="Votação" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {players.map((p) => {
          const dead = !m.voters.includes(p.seat);
          const voted = m.voted.includes(p.seat);
          const isPicked = picked === p.seat;
          const disabled = !canVote || dead;
          return (
            <li key={p.seat} className="relative">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPicked(p.seat)}
                aria-label={`${p.nickname}${dead ? ', fora' : ''}${voted ? ', já votou' : ''}${speaking.has(p.userId) ? ', falando' : ''}`}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl border-2 bg-slate-800 px-2 py-1.5 text-left transition',
                  isPicked ? 'border-cyan-300 ring-2 ring-cyan-300' : speaking.has(p.userId) ? 'border-emerald-300 shadow-[0_0_12px_2px_rgb(110_231_183/0.6)]' : 'border-slate-950',
                  dead && 'opacity-45',
                  !disabled && 'hover:border-cyan-400',
                )}
              >
                <span className="relative shrink-0">
                  <DiverIcon color={p.color} dead={dead} className="size-10" />
                  {m.caller === p.seat && (
                    <span aria-label="Chamou a reunião" className="absolute -top-1 -left-1 text-sm">
                      📣
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <b className={cn('truncate text-sm', dead && 'line-through')}>{p.nickname}</b>
                  <span className="text-[11px] font-semibold text-slate-400">{p.seat === mySeat ? 'Você' : dead ? 'Fora' : voted ? 'Votou ✔' : m.stage === 'vote' ? 'Pensando…' : ''}</span>
                </span>
              </button>
              {m.stage === 'result' && votesFor(p.seat).length > 0 && (
                <span className="absolute right-1 bottom-1 flex -space-x-1.5" aria-label={`${votesFor(p.seat).length} votos`}>
                  {votesFor(p.seat).map((v) => (
                    <span key={v} className="size-4 rounded-full border border-black" style={{ background: INF_COLORS[state.seats[v]?.color ?? 0].body }} />
                  ))}
                </span>
              )}
              {isPicked && (
                <span className="absolute inset-y-0 right-1 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Confirmar voto em ${p.nickname}`}
                    onClick={() => void vote(p.seat)}
                    className="grid size-9 place-items-center rounded-full border-2 border-black bg-emerald-400 text-emerald-950"
                  >
                    <Check aria-hidden className="size-5" />
                  </button>
                  <button type="button" aria-label="Cancelar" onClick={() => setPicked(null)} className="grid size-9 place-items-center rounded-full border-2 border-black bg-rose-400 text-rose-950">
                    <X aria-hidden className="size-5" />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canVote}
          onClick={() => void vote(-1)}
          className="flex h-11 items-center gap-1 rounded-xl border-2 border-black bg-slate-300 px-4 font-black text-slate-900 disabled:opacity-40"
        >
          <SkipForward aria-hidden className="size-4" /> PULAR VOTO
        </button>
        {m.stage === 'result' && votesFor(-1).length > 0 && (
          <span className="flex -space-x-1.5" aria-label={`${votesFor(-1).length} pularam`}>
            {votesFor(-1).map((v) => (
              <span key={v} className="size-4 rounded-full border border-black" style={{ background: INF_COLORS[state.seats[v]?.color ?? 0].body }} />
            ))}
          </span>
        )}
      </div>
    </section>
  );

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="inf-meeting-title" className="absolute inset-0 z-30 flex flex-col bg-[radial-gradient(ellipse_at_top,#0e3a52,#04121f_70%)] text-white">
      <header className="flex shrink-0 flex-col items-center gap-0.5 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 text-center">
        <h2 id="inf-meeting-title" className="font-display text-2xl font-black tracking-wide text-amber-300 drop-shadow-[0_2px_0_#000] sm:text-3xl">
          {m.body !== null ? 'CORPO ENCONTRADO!' : 'REUNIÃO DE EMERGÊNCIA'}
        </h2>
        <p className="text-sm text-slate-200">{m.body !== null ? `${name(m.caller)} encontrou ${name(m.body)}` : `${name(m.caller)} apertou o botão`}</p>
        <p role="timer" className={cn('font-display mt-1 rounded-full px-3 text-lg tabular-nums', m.stage === 'vote' ? 'bg-rose-500 text-white' : 'bg-white/10')}>
          {STAGE_LABEL[m.stage]} {m.stage !== 'result' && `· ${Math.ceil(m.left)}s`}
        </p>
        <div className="mt-1.5">
          <MeetingVoiceBar voice={voice} canTalk={canTalk} />
        </div>
      </header>

      <div className="flex shrink-0 gap-1 px-3 md:hidden" role="tablist">
        {(
          [
            ['vote', 'Votação', Users],
            ['chat', 'Chat', MessageCircle],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('relative flex h-10 flex-1 items-center justify-center gap-1 rounded-t-xl font-bold', tab === id ? 'bg-slate-900/80 text-white' : 'text-slate-400')}
          >
            <Icon aria-hidden className="size-4" /> {label}
            {id === 'chat' && unread > 0 && tab !== 'chat' && <span className="absolute top-1 right-3 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-xs">{unread}</span>}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 gap-3 bg-slate-900/80 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:mx-auto md:w-full md:max-w-5xl md:rounded-2xl md:bg-slate-900/70">
        <div className={cn('min-h-0 flex-1 flex-col', tab === 'vote' ? 'flex' : 'hidden md:flex')}>{ballot}</div>
        <div className={cn('min-h-0 flex-col md:flex md:w-80', tab === 'chat' ? 'flex flex-1' : 'hidden')}>
          <Chat state={state} frame={frame} actions={actions} active={tab === 'chat'} />
        </div>
      </div>
    </div>
  );
}
