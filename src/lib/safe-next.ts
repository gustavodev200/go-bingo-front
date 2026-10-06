const BASE = 'https://internal.invalid';
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/** Só permite caminhos internos; qualquer outra coisa vira "/". */
export function safeNextPath(raw?: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  // O parser de URL descarta tab/CR/LF, então "/\t/evil.com" viraria "//evil.com".
  if (CONTROL_CHARS.test(raw)) return '/';
  const url = new URL(raw, BASE);
  if (url.origin !== BASE) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}
