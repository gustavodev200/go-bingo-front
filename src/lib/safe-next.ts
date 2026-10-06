/** Só permite caminhos internos; qualquer outra coisa vira "/". */
export function safeNextPath(raw?: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}
