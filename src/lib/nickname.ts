import { isNicknameAllowed, nicknameSchema } from '@/contracts';

export function suggestNickname(fullName?: string | null): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  const cleaned = first.replace(/[^A-Za-z0-9_À-ú]/g, '').slice(0, 16);
  return nicknameSchema.safeParse(cleaned).success && isNicknameAllowed(cleaned) ? cleaned : '';
}
