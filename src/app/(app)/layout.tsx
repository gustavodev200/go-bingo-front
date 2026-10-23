import { AppDock } from '@/features/nav/app-dock';
import { PresenceProvider } from '@/features/presence/presence-context';
import { RequireNickname } from '@/features/profile/profile-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireNickname>
      <PresenceProvider>
        {children}
        <AppDock />
      </PresenceProvider>
    </RequireNickname>
  );
}
