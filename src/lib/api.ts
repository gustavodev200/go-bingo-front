import type { z } from 'zod';
import { errorCodeSchema, type ErrorCode } from '@/contracts';
import { env } from '@/lib/env';
import { getAccessToken } from './session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new ApiError(0, 'INTERNAL', 'Sem conexão com o servidor');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body as { code?: unknown; message?: unknown } | null;
    const code = errorCodeSchema.safeParse(err?.code);
    throw new ApiError(res.status, code.success ? code.data : 'INTERNAL', typeof err?.message === 'string' ? err.message : 'Erro inesperado');
  }
  return schema.parse(body);
}
