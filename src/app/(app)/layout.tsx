import { AppDock } from '@/features/nav/app-dock';
import { RequireNickname } from '@/features/profile/profile-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireNickname>
      {children}
      <AppDock />
    </RequireNickname>
  );
}
