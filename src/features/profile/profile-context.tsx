'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { profileSchema, type Profile } from '@/contracts';
import { ApiError, apiFetch } from '@/lib/api';

interface ProfileContextValue {
  profile: Profile;
  refresh(): Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile usado fora de <RequireNickname>');
  return ctx;
}

export function RequireNickname({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await apiFetch('/me', profileSchema);
      if (!p.nickname) return router.replace(`/apelido?next=${encodeURIComponent(pathname)}`);
      setProfile(p);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      setFailed(true);
    }
  }, [router, pathname]);

  useEffect(() => {
    // setState só acontece depois do await (assíncrono), não durante o effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (failed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4" role="alert">
        <p>Não foi possível carregar seu perfil.</p>
        <Button
          onClick={() => {
            setFailed(false);
            void load();
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (!profile) return <div className="flex min-h-dvh items-center justify-center" aria-busy="true">Carregando…</div>;
  return <ProfileContext.Provider value={{ profile, refresh: load }}>{children}</ProfileContext.Provider>;
}
