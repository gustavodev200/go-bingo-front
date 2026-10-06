'use client';

import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import type { Group } from 'three';
import { useGameStore } from '../store';
import { botName } from './bots';
import { labelIds } from './choreographer';
import { pose, type AvatarState } from './pose';

function Label({ userId, nickname, statesRef, isMe }: { userId: string; nickname: string; statesRef: RefObject<Map<string, AvatarState>>; isMe: boolean }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const s = statesRef.current?.get(userId);
    if (!group.current || !s) return;
    const p = pose(s, performance.now());
    group.current.position.set(p.position[0], p.position[1] + 1.65 * p.scale, p.position[2]);
    group.current.scale.setScalar(Math.max(0.0001, p.scale));
  });
  return (
    <group ref={group}>
      <Billboard>
        <Text fontSize={0.22} color={isMe ? '#fde047' : '#ffffff'} outlineWidth={0.025} outlineColor="#1e1b4b" anchorX="center" anchorY="bottom" maxWidth={2.2}>
          {nickname}
        </Text>
      </Billboard>
    </group>
  );
}

/** Apelidos como texto (nunca HTML). Sala cheia no celular: só o meu, o do host e de quem chega. */
export function NameLabels({ list, statesRef, showAll }: { list: AvatarState[]; statesRef: RefObject<Map<string, AvatarState>>; showAll: boolean }) {
  const members = useGameStore((s) => s.snapshot?.members);
  const myUserId = useGameStore((s) => s.myUserId);
  const visible = labelIds(list, myUserId, showAll);
  return (
    <>
      {list
        .filter((s) => visible.has(s.userId))
        .map((s) => {
          const nickname = members?.find((m) => m.userId === s.userId)?.nickname ?? botName(s.userId) ?? '';
          return <Label key={s.userId} userId={s.userId} nickname={nickname} statesRef={statesRef} isMe={s.userId === myUserId} />;
        })}
    </>
  );
}
