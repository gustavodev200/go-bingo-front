import { avatarFromId } from './avatar-look';
import { PHASE_MS, TEMPORARY_PHASES, type AvatarState, type Phase } from './pose';

export interface SceneMember {
  userId: string;
  slot: number;
  connected: boolean;
  hasCard: boolean;
}

export interface ChoreoInput {
  members: SceneMember[];
  hostId: string;
  now: number;
}

export const LOOK_AT_DOOR_MS = 1000;

function settle(old: AvatarState, now: number): { phase: Phase; phaseStart: number } {
  if (TEMPORARY_PHASES.includes(old.phase) && now - old.phaseStart >= PHASE_MS[old.phase as keyof typeof PHASE_MS]) {
    return { phase: old.connected ? 'idle' : 'ghost', phaseStart: now };
  }
  return { phase: old.phase, phaseStart: old.phaseStart };
}

/**
 * Deriva o estado de animação de cada avatar a partir do snapshot da sala (store) e do estado anterior.
 * `prev === null` é o primeiro snapshot ao entrar: todos já estão no lugar (sem desfile de entradas).
 */
export function choreograph(prev: ReadonlyMap<string, AvatarState> | null, { members, hostId, now }: ChoreoInput): Map<string, AvatarState> {
  const next = new Map<string, AvatarState>();
  const arrived: string[] = [];

  for (const member of members) {
    const old = prev?.get(member.userId);
    let phase: Phase;
    let phaseStart: number;

    if (!old || old.phase === 'leaving') {
      if (prev === null) {
        phase = member.connected ? 'idle' : 'ghost';
      } else {
        phase = 'entering';
        arrived.push(member.userId);
      }
      phaseStart = now;
    } else {
      ({ phase, phaseStart } = settle(old, now));
      if (!member.connected) {
        if (phase !== 'ghost') [phase, phaseStart] = ['ghost', now];
      } else if (phase === 'ghost') {
        [phase, phaseStart] = ['idle', now];
      } else if (member.hasCard && !old.hasCard && phase === 'idle') {
        [phase, phaseStart] = ['ready-jump', now];
      }
    }

    next.set(member.userId, {
      userId: member.userId,
      slot: member.slot,
      look: old?.look ?? avatarFromId(member.userId),
      phase,
      phaseStart,
      isHost: member.userId === hostId,
      connected: member.connected,
      hasCard: member.hasCard,
      lookAtDoorUntil: old?.lookAtDoorUntil ?? 0,
    });
  }

  for (const [userId, old] of prev ?? []) {
    if (next.has(userId)) continue;
    if (old.phase !== 'leaving') next.set(userId, { ...old, phase: 'leaving', phaseStart: now, isHost: false });
    else if (now - old.phaseStart < PHASE_MS.leaving) next.set(userId, old);
  }

  if (arrived.length > 0) {
    for (const [userId, s] of next) {
      if (!arrived.includes(userId) && s.phase === 'idle') next.set(userId, { ...s, lookAtDoorUntil: now + LOOK_AT_DOOR_MS });
    }
  }
  return next;
}

/** Toque no avatar: só o meu, e só quando está parado. Retorna o mesmo Map se nada mudou. */
export function triggerDance(states: ReadonlyMap<string, AvatarState>, userId: string, myUserId: string, now: number): Map<string, AvatarState> {
  const current = states.get(userId);
  if (userId !== myUserId || current?.phase !== 'idle') return states as Map<string, AvatarState>;
  const next = new Map(states);
  next.set(userId, { ...current, phase: 'dance', phaseStart: now });
  return next;
}

/** Mudou algo que exige re-render (entrou/saiu alguém, mudou fase ou coroa)? Pose por frame não conta. */
export function statesChanged(a: ReadonlyMap<string, AvatarState> | null, b: ReadonlyMap<string, AvatarState>): boolean {
  if (a?.size !== b.size) return true;
  for (const [id, s] of b) {
    const o = a.get(id);
    if (o?.phase !== s.phase || o.phaseStart !== s.phaseStart || o.isHost !== s.isHost) return true;
  }
  return false;
}

/** Rótulos visíveis: todos, ou (sala cheia no celular) só o meu, o do host e de quem está chegando. Quem sai, nunca. */
export function labelIds(states: Iterable<AvatarState>, myUserId: string | null, showAll: boolean): Set<string> {
  const ids = new Set<string>();
  for (const s of states) {
    if (s.phase === 'leaving') continue;
    if (showAll || s.userId === myUserId || s.isHost || s.phase === 'entering') ids.add(s.userId);
  }
  return ids;
}
