'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import { CanvasTexture, SRGBColorSpace, type Sprite, type SpriteMaterial } from 'three';
import { EMOTE_SYMBOLS, type Emote } from '@/contracts';
import { REACTION_MS, useGameStore, type Reaction } from '../store';
import { bubbleFrame, latestPerUser } from './emote-bubble';
import { pose, type AvatarState } from './pose';

const SIZE = 0.62;
const textures = new Map<Emote, CanvasTexture>();

/**
 * Emoji desenhado num canvas 2D com a fonte de emoji do sistema (o <Text> do troika não tem glifos de emoji).
 * Só a partir do enum fixo de emotes — nunca texto de usuário. Uma textura por emote, reaproveitada.
 */
function emoteTexture(emote: Emote): CanvasTexture {
  const cached = textures.get(emote);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(30, 27, 75, 0.85)';
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '76px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(EMOTE_SYMBOLS[emote], 64, 70);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  textures.set(emote, texture);
  return texture;
}

function Bubble({ reaction, statesRef }: { reaction: Reaction; statesRef: RefObject<Map<string, AvatarState>> }) {
  const sprite = useRef<Sprite>(null);
  const born = useRef<number | null>(null);
  const map = useMemo(() => emoteTexture(reaction.emote), [reaction.emote]);

  useFrame(() => {
    const s = sprite.current;
    const avatar = statesRef.current?.get(reaction.userId);
    if (!s) return;
    const now = performance.now();
    born.current ??= now;
    const frame = bubbleFrame((now - born.current) / REACTION_MS);
    if (!avatar || !frame.visible) {
      s.visible = false;
      return;
    }
    const p = pose(avatar, now);
    s.visible = true;
    // Acima do apelido (que fica em 1,72 × escala).
    s.position.set(p.position[0], p.position[1] + (2.15 + frame.rise) * p.scale, p.position[2]);
    s.scale.setScalar(Math.max(0.0001, SIZE * frame.scale * p.scale));
    (s.material as SpriteMaterial).opacity = frame.opacity;
  });

  return (
    <sprite ref={sprite} visible={false} renderOrder={10}>
      <spriteMaterial map={map} transparent depthWrite={false} depthTest={false} toneMapped={false} />
    </sprite>
  );
}

/** Bolhas de emote sobre os bonecos: a última reação de cada um. */
export function EmoteBubbles({ statesRef }: { statesRef: RefObject<Map<string, AvatarState>> }) {
  const reactions = useGameStore((s) => s.reactions);
  return (
    <>
      {latestPerUser(reactions).map((r) => (
        <Bubble key={r.id} reaction={r} statesRef={statesRef} />
      ))}
    </>
  );
}
