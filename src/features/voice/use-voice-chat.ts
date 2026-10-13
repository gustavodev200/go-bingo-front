'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { VOICE_NAMESPACE, type VoiceGame } from '@/contracts';
import { createSocket } from '@/lib/socket';
import { browserVoiceDeps, voiceSupported } from './browser-deps';
import { VOICE_OFF, VoiceEngine, type VoiceDeps, type VoiceView } from './voice-engine';

export interface VoiceChat {
  view: VoiceView;
  supported: boolean;
  join(): void;
  leave(): void;
  setMuted(muted: boolean): void;
}

const defaultDeps = () => browserVoiceDeps(createSocket(VOICE_NAMESPACE));

/** Voice channel of one game room. Off until the player joins; leaving the page leaves it. */
export function useVoiceChat(game: VoiceGame, code: string, makeDeps: () => VoiceDeps = defaultDeps): VoiceChat {
  const [view, setView] = useState<VoiceView>(VOICE_OFF);
  const [supported] = useState(voiceSupported);
  const engine = useRef<VoiceEngine | null>(null);
  const makeDepsRef = useRef(makeDeps);

  useEffect(
    () => () => {
      engine.current?.stop();
      engine.current = null;
      setView(VOICE_OFF);
    },
    [game, code],
  );

  const join = useCallback(() => {
    if (engine.current) return;
    const created: VoiceEngine = new VoiceEngine(game, code, makeDepsRef.current(), {
      onChange: (next) => {
        if (engine.current !== created) return;
        if (next.status === 'off') engine.current = null;
        setView(next);
      },
      onNotice: (message) => toast(message),
    });
    engine.current = created;
    void created.start();
  }, [game, code]);

  return useMemo(
    () => ({
      view,
      supported,
      join,
      leave: () => engine.current?.stop(),
      setMuted: (muted: boolean) => engine.current?.setMuted(muted),
    }),
    [view, supported, join],
  );
}
