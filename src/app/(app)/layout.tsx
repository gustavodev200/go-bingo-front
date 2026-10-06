import { RequireNickname } from '@/features/profile/profile-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <RequireNickname>{children}</RequireNickname>;
}
