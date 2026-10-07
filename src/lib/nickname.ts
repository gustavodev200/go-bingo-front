import { isNicknameAllowed, nicknameSchema } from '@/contracts';

export function suggestNickname(fullName?: string | null): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  const cleaned = first.replace(/[^A-Za-z0-9_À-ú]/g, '').slice(0, 16);
  return nicknameSchema.safeParse(cleaned).success && isNicknameAllowed(cleaned) ? cleaned : '';
}

export type NicknameCheck = { ok: true; value: string } | { ok: false; error: string };

/** Mesma regra do servidor (formato + lista de bloqueio), para avisar antes de enviar. */
export function validateNickname(raw: string): NicknameCheck {
  const parsed = nicknameSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!isNicknameAllowed(parsed.data)) return { ok: false, error: 'Apelido não permitido' };
  return { ok: true, value: parsed.data };
}
