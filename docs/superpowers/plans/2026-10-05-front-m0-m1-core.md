# Go Bingo Front — M0+M1 (Fundação + Jogo Jogável em HUD 2D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o app Next.js em que o jogador entra com Google ou como convidado, escolhe apelido, cria/entra em salas e joga uma partida completa de bingo contra o back — tudo em HUD 2D mobile-first, que vira a base (e o "modo 2D") das cenas 3D dos marcos M3/M4.

**Architecture:** Next.js 16 App Router. Auth pelo Supabase (`@supabase/ssr`, PKCE) com `proxy.ts` renovando a sessão. Dados REST via `apiFetch` com Bearer do Supabase; jogo via Socket.IO (`/game`) alimentando uma store Zustand cujo reducer puro aplica os eventos do servidor. Componentes de HUD são DOM acessível; a região "palco" do layout é onde o canvas 3D entrará depois.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Zustand 5, Zod 4, socket.io-client 4, @supabase/ssr + @supabase/supabase-js, @marsidev/react-turnstile, Vitest + Testing Library.

**Spec:** [docs/PRD.md](../../PRD.md) · Roadmap: [2026-10-05-roadmap.md](2026-10-05-roadmap.md) · Back: `go-bingo-back/docs/superpowers/plans/2026-10-05-back-m0-m1-core.md`

## Global Constraints

- `src/contracts/` é **gerado** pelo back (`npm run contracts:sync` em `go-bingo-back`). Nunca editar aqui.
- O front nunca decide regra de jogo: cartela, sorteio, validação de bingo e pontos vêm do servidor. O front só habilita botões e mostra estado.
- O front **não** acessa tabelas do Supabase — só `supabase.auth.*`. Dados vêm da API Nest.
- Toda entrada de formulário validada com os schemas Zod de `src/contracts` antes de enviar.
- Redirecionamentos pós-login só para caminhos internos (`safeNextPath`): começa com `/`, não com `//` nem `/\`.
- Mobile-first: layout funcional de 320 px de largura, retrato e paisagem; usar `100dvh` e `env(safe-area-inset-*)`; alvos de toque ≥ 44×44 px; `touch-manipulation` na cartela.
- Acessibilidade: número sorteado anunciado em `aria-live="polite"`; botões com rótulo; estados da cartela com `aria-pressed`.
- Textos de interface em pt-BR.
- Nome/foto do Google nunca exibidos a outros jogadores — só o apelido.
- Comandos assumem Git Bash no Windows, a partir de `E:/projetos/go-bingo/go-bingo-front`.
- Constituição, Princípio VIII (adicionado em 2026-10-05): cobertura de testes unitários ≥80% (statements/branches/functions/lines) sobre `src/` excluindo `src/contracts/` (gerado) e `src/app/**` quando for só roteamento sem lógica própria; CI falha abaixo do limiar. Task 12 configura o gate.

## Review Focus

1. **Link aberto dentro do Instagram/Facebook** → botão do Google substituído por "Abra no navegador" + convidado continua disponível. Teste em Task 4 (`in-app browser`).
2. **`next` malicioso no login/callback** (`//evil.com`, `https://evil.com`) → cai em `/`. Teste em Task 3 (`safeNextPath`).
3. **Eventos repetidos ou fora de ordem após reconexão** (mesmo `game:number_drawn` duas vezes, `room:state` depois de `game:won`) → sem número duplicado; snapshot novo zera o resultado. Teste em Task 7 (`is idempotent`, `room:state clears result`).
4. **Toque numa pedra ainda não sorteada / toque duplo** → não marca, avisa "ainda não saiu", sem zoom. Teste em Task 8 (`locked cell`).
5. **Convidado tenta virar conta com um Google que já existe** → explicação + opção de entrar nessa conta. Teste em Task 10 (`identity_already_exists`).

---

## File Structure

```
go-bingo-front/
  .env.example · vitest.config.mts · vitest.setup.ts · .github/workflows/ci.yml
  src/
    proxy.ts                         renova sessão Supabase, manda não logado para /login
    contracts/                       GERADO pelo back
    lib/
      env.ts                         env públicas validadas
      safe-next.ts                   safeNextPath
      in-app-browser.ts              isInAppBrowser, chromeIntentUrl
      nickname.ts                    suggestNickname
      supabase/client.ts · server.ts · proxy.ts
      session.ts                     getAccessToken
      api.ts                         apiFetch, ApiError
      socket.ts                      createGameSocket, emitAck
    features/
      auth/login-panel.tsx · guest-button.tsx · upgrade-button.tsx · nickname-form.tsx
      profile/profile-context.tsx    RequireNickname + useProfile
      rooms/join-by-code-form.tsx · create-room-form.tsx · use-public-rooms.ts · public-rooms.tsx
      ranking/ranking-list.tsx
      game/
        store.ts                     reducer puro + store Zustand + seletores
        one-away.ts                  newlyOneAway
        use-game-connection.ts       socket da sala → store; ações
        card-grid.tsx · last-numbers.tsx · remaining-panel.tsx · members-list.tsx · share-code.tsx
        connection-banner.tsx · result-dialog.tsx · lobby-view.tsx · game-view.tsx · room-screen.tsx
    app/
      layout.tsx · globals.css
      login/page.tsx · auth/callback/route.ts · auth/erro/page.tsx · apelido/page.tsx
      (app)/layout.tsx · (app)/page.tsx · (app)/criar/page.tsx · (app)/ranking/page.tsx · (app)/[code]/page.tsx
```

---

### Task 1: Scaffold Next.js, shadcn, Vitest, env e CI

**Files:**
- Create (via CLI, depois movidos): `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/*`, `components.json`, `src/components/ui/*`, `src/lib/utils.ts`
- Create: `vitest.config.mts`, `vitest.setup.ts`, `.env.example`, `src/lib/env.ts`, `src/lib/env.test.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `env` = `{ NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_TURNSTILE_SITE_KEY }`, `parsePublicEnv(source)`. Componentes shadcn `Button`, `Input`, `Label`, `Card`, `Dialog`, `Badge`, `Toaster` (sonner).

- [ ] **Step 1: Gerar o app numa pasta temporária e mover**

```bash
cd E:/projetos/go-bingo
npx create-next-app@16 go-bingo-front-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
cd go-bingo-front-tmp
cp -r src public package.json package-lock.json next.config.ts tsconfig.json eslint.config.mjs postcss.config.mjs next-env.d.ts ../go-bingo-front/
cat .gitignore >> ../go-bingo-front/.gitignore
cd .. && rm -rf go-bingo-front-tmp
cd go-bingo-front
npm install
npm install zod@4 zustand@5 socket.io-client@4 @supabase/ssr @supabase/supabase-js @marsidev/react-turnstile
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom vite-tsconfig-paths
npx shadcn@latest init -d
npx shadcn@latest add button input label card dialog badge sonner
```

- [ ] **Step 2: Vitest**

`vitest.config.mts`:

```ts
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.local',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      NEXT_PUBLIC_API_URL: 'http://api.test',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    },
  },
});
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Em `package.json` → `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Teste falhando do env**

`src/lib/env.test.ts`:

```ts
import { parsePublicEnv } from './env';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  NEXT_PUBLIC_API_URL: 'http://localhost:3333',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'key',
};

describe('parsePublicEnv', () => {
  it('accepts a complete env', () => {
    expect(parsePublicEnv(valid)).toEqual(valid);
  });

  it('names the missing variable', () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_API_URL: undefined })).toThrow(/NEXT_PUBLIC_API_URL/);
  });
});
```

Run: `npm test -- src/lib/env` → FAIL (módulo inexistente).

- [ ] **Step 4: Implementar**

`src/lib/env.ts`:

```ts
import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof schema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error(`Variáveis públicas inválidas:\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

// Cada variável referenciada explicitamente para o Next embutir no bundle do cliente.
export const env = parsePublicEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
});
```

`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_API_URL=http://localhost:3333
# Chave de teste do Turnstile que sempre passa (troque pela real em produção).
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

```bash
cp .env.example .env.local   # preencha com o seu projeto Supabase
```

Run: `npm test -- src/lib/env` → PASS.

- [ ] **Step 5: Contratos do back**

Com o Task 2 do plano do back já commitado:

```bash
cd ../go-bingo-back && npm run contracts:sync && cd ../go-bingo-front
npx tsc --noEmit
```

Expected: `src/contracts/*.ts` presentes, typecheck sem erros.

- [ ] **Step 6: CI**

`.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: https://ci.supabase.local
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb_publishable_ci
      NEXT_PUBLIC_API_URL: http://localhost:3333
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 1x00000000000000000000AA
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A
git commit -m "chore: scaffold Next.js 16 with shadcn, vitest, env validation, contracts and CI"
```

---

### Task 2: Utilitários puros — `safeNextPath`, navegador embutido, sugestão de apelido

**Files:**
- Create: `src/lib/safe-next.ts`, `src/lib/in-app-browser.ts`, `src/lib/nickname.ts`
- Test: `src/lib/safe-next.test.ts`, `src/lib/in-app-browser.test.ts`, `src/lib/nickname.test.ts`

**Interfaces:**
- Consumes: `nicknameSchema`, `isNicknameAllowed` (contratos).
- Produces: `safeNextPath(raw?: string | null): string`, `isInAppBrowser(ua: string): boolean`, `chromeIntentUrl(href: string): string`, `suggestNickname(fullName?: string | null): string`.

- [ ] **Step 1: Testes falhando**

`src/lib/safe-next.test.ts`:

```ts
import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it.each([
    ['/ABC234', '/ABC234'],
    ['/ranking?x=1', '/ranking?x=1'],
    [null, '/'],
    [undefined, '/'],
    ['', '/'],
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['javascript:alert(1)', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
```

`src/lib/in-app-browser.test.ts`:

```ts
import { chromeIntentUrl, isInAppBrowser } from './in-app-browser';

describe('isInAppBrowser', () => {
  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0.0.0',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0;]',
    'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0]',
    'Mozilla/5.0 (Linux; Android 14) musical_ly_2023 BytedanceWebview',
  ])('detects %s', (ua) => {
    expect(isInAppBrowser(ua)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  ])('ignores regular browser %s', (ua) => {
    expect(isInAppBrowser(ua)).toBe(false);
  });
});

describe('chromeIntentUrl', () => {
  it('builds an Android intent that opens Chrome', () => {
    expect(chromeIntentUrl('https://gobingo.app/ABC234?x=1')).toBe(
      'intent://gobingo.app/ABC234?x=1#Intent;scheme=https;package=com.android.chrome;end',
    );
  });
});
```

`src/lib/nickname.test.ts`:

```ts
import { suggestNickname } from './nickname';

describe('suggestNickname', () => {
  it('uses the first name', () => {
    expect(suggestNickname('Gustavo Lage')).toBe('Gustavo');
  });

  it('strips unsupported characters and truncates to 16', () => {
    expect(suggestNickname("D'Ávila-Superlongnamehere")).toBe('DÁvilaSuperlongn');
  });

  it('returns empty when nothing valid remains', () => {
    expect(suggestNickname(undefined)).toBe('');
    expect(suggestNickname('李')).toBe('');
    expect(suggestNickname('Jo')).toBe('');
  });
});
```

Run: `npm test -- src/lib` → FAIL.

- [ ] **Step 2: Implementar**

`src/lib/safe-next.ts`:

```ts
/** Só permite caminhos internos; qualquer outra coisa vira "/". */
export function safeNextPath(raw?: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}
```

`src/lib/in-app-browser.ts`:

```ts
const IN_APP_PATTERNS = [/Instagram/i, /FBAN|FBAV|FB_IAB/i, /\bLine\//i, /musical_ly|BytedanceWebview|TikTok/i, /Snapchat/i, /LinkedInApp/i];

/** Navegadores embutidos onde o Google bloqueia OAuth (disallowed_useragent). */
export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function chromeIntentUrl(href: string): string {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(':', '')};package=com.android.chrome;end`;
}
```

`src/lib/nickname.ts`:

```ts
import { isNicknameAllowed, nicknameSchema } from '@/contracts';

export function suggestNickname(fullName?: string | null): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  const cleaned = first.replace(/[^A-Za-z0-9_À-ú]/g, '').slice(0, 16);
  return nicknameSchema.safeParse(cleaned).success && isNicknameAllowed(cleaned) ? cleaned : '';
}
```

Run: `npm test -- src/lib` → PASS.

- [ ] **Step 3: Commit**

```bash
npm run lint && npm run typecheck
git add src/lib
git commit -m "feat: safe redirect, in-app browser detection and nickname suggestion"
```

---

### Task 3: Supabase (clientes, `proxy.ts`, callback OAuth) e `apiFetch`

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`, `src/proxy.ts`
- Create: `src/app/auth/callback/route.ts`, `src/lib/session.ts`, `src/lib/api.ts`
- Test: `src/lib/api.test.ts`, `src/app/auth/callback/route.test.ts`

**Interfaces:**
- Consumes: `env`, `safeNextPath`, contratos (`errorCodeSchema`).
- Produces: `createClient()` (browser), `createServerSupabase()` (server), `updateSession(request)`, `getAccessToken(): Promise<string | null>`, `class ApiError { status; code; message }`, `apiFetch<T>(path, schema, init?): Promise<T>`. Rotas: `/auth/callback?code&next` → redireciona para `next` seguro; com `error_code` → `/auth/erro?code=<error_code>`.

- [ ] **Step 1: Clientes Supabase e proxy**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
```

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de Server Component: o proxy.ts renova a sessão.
        }
      },
    },
  });
}
```

`src/lib/supabase/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

const PUBLIC_PREFIXES = ['/login', '/auth'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Não colocar código entre createServerClient e getClaims (doc do Supabase).
  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;
  if (!data?.claims && !PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
```

`src/proxy.ts`:

```ts
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)'],
};
```

- [ ] **Step 2: Testes falhando de `apiFetch` e do callback**

`src/lib/api.test.ts`:

```ts
import { z } from 'zod';
import { ApiError, apiFetch } from './api';

vi.mock('./session', () => ({ getAccessToken: vi.fn(async () => 'tok-123') }));

describe('apiFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the bearer token and parses with the schema', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 'ABC234' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/rooms', z.object({ code: z.string() }), { method: 'POST', body: '{}' })).resolves.toEqual({ code: 'ABC234' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/rooms');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('maps the backend error body to ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'ROOM_FULL', message: 'Sala cheia' }), { status: 409 })));
    await expect(apiFetch('/rooms/X', z.unknown())).rejects.toMatchObject({ status: 409, code: 'ROOM_FULL', message: 'Sala cheia' });
  });

  it('turns network failures into ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(apiFetch('/me', z.unknown())).rejects.toBeInstanceOf(ApiError);
  });
});
```

`src/app/auth/callback/route.test.ts`:

```ts
// @vitest-environment node
import { GET } from './route';

const exchangeCodeForSession = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { exchangeCodeForSession } }),
}));

describe('GET /auth/callback', () => {
  it('exchanges the code and redirects to a safe next', async () => {
    const res = await GET(new Request('http://localhost:3000/auth/callback?code=abc&next=/ABC234'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(res.headers.get('location')).toBe('http://localhost:3000/ABC234');
  });

  it('ignores an external next', async () => {
    const res = await GET(new Request('http://localhost:3000/auth/callback?code=abc&next=//evil.com'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('forwards provider errors to the error page', async () => {
    const res = await GET(new Request('http://localhost:3000/auth/callback?error=server_error&error_code=identity_already_exists'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/auth/erro?code=identity_already_exists');
  });

  it('sends a failed exchange to the error page', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: new Error('bad') } as never);
    const res = await GET(new Request('http://localhost:3000/auth/callback?code=bad'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/auth/erro?code=exchange_failed');
  });
});
```

Run: `npm test -- src/lib/api src/app/auth` → FAIL.

- [ ] **Step 3: Implementar**

`src/lib/session.ts`:

```ts
import { createClient } from '@/lib/supabase/client';

export async function getAccessToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}
```

`src/lib/api.ts`:

```ts
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
```

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { safeNextPath } from '@/lib/safe-next';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const errorCode = searchParams.get('error_code') ?? (searchParams.get('error') ? 'oauth_error' : null);
  if (errorCode) return NextResponse.redirect(`${origin}/auth/erro?code=${encodeURIComponent(errorCode)}`);

  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/auth/erro?code=exchange_failed`);
}
```

Run: `npm test -- src/lib/api src/app/auth` → PASS.

- [ ] **Step 4: Commit**

```bash
npm run lint && npm run typecheck
git add src/lib src/proxy.ts src/app/auth
git commit -m "feat(auth): supabase ssr clients, session proxy, oauth callback and api client"
```

---

### Task 4: Tela de login — Google, convidado com Turnstile, navegador embutido

**Files:**
- Create: `src/features/auth/login-panel.tsx`, `src/features/auth/guest-button.tsx`, `src/app/login/page.tsx`
- Modify: `src/app/layout.tsx` (Toaster, viewport, `lang="pt-BR"`), `src/app/globals.css` (fundo/tema)
- Test: `src/features/auth/login-panel.test.tsx`

**Interfaces:**
- Consumes: `createClient`, `isInAppBrowser`, `chromeIntentUrl`, `env`.
- Produces: `<LoginPanel userAgent next />`, `<GuestButton next />`. Página `/login?next=`.

- [ ] **Step 1: Teste falhando**

`src/features/auth/login-panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPanel } from './login-panel';

const signInWithOAuth = vi.fn(async () => ({ error: null }));
const signInAnonymously = vi.fn(async () => ({ error: null }));
const replace = vi.fn();

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOAuth, signInAnonymously } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (t: string) => void }) => <button onClick={() => onSuccess('captcha-ok')}>captcha</button>,
}));

const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const INSTAGRAM = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Instagram 300.0.0.0';

describe('LoginPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts Google OAuth keeping the destination', async () => {
    render(<LoginPanel userAgent={CHROME} next="/ABC234" />);
    await userEvent.click(screen.getByRole('button', { name: /entrar com google/i }));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2FABC234` },
    });
  });

  it('signs in as guest after the captcha and goes to nickname', async () => {
    render(<LoginPanel userAgent={CHROME} next="/ABC234" />);
    await userEvent.click(screen.getByRole('button', { name: /jogar como convidado/i }));
    await userEvent.click(screen.getByRole('button', { name: 'captcha' }));
    expect(signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: 'captcha-ok' } });
    expect(replace).toHaveBeenCalledWith('/apelido?next=%2FABC234');
  });

  it('in-app browser: hides Google, explains, keeps guest', () => {
    render(<LoginPanel userAgent={INSTAGRAM} next="/" />);
    expect(screen.queryByRole('button', { name: /entrar com google/i })).not.toBeInTheDocument();
    expect(screen.getByText(/abra no navegador/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jogar como convidado/i })).toBeInTheDocument();
  });
});
```

Run: `npm test -- src/features/auth` → FAIL.

- [ ] **Step 2: Implementar**

`src/features/auth/guest-button.tsx`:

```tsx
'use client';

import { Turnstile } from '@marsidev/react-turnstile';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

export function GuestButton({ next }: { next: string }) {
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);

  async function signIn(captchaToken: string) {
    const { error } = await createClient().auth.signInAnonymously({ options: { captchaToken } });
    if (error) {
      setVerifying(false);
      toast.error('Não foi possível entrar como convidado. Tente novamente.');
      return;
    }
    router.replace(`/apelido?next=${encodeURIComponent(next)}`);
  }

  if (verifying) {
    return <Turnstile siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onSuccess={(token) => void signIn(token)} options={{ size: 'flexible' }} />;
  }
  return (
    <Button variant="secondary" size="lg" className="w-full" onClick={() => setVerifying(true)}>
      Jogar como convidado
    </Button>
  );
}
```

`src/features/auth/login-panel.tsx`:

```tsx
'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { chromeIntentUrl, isInAppBrowser } from '@/lib/in-app-browser';
import { createClient } from '@/lib/supabase/client';
import { GuestButton } from './guest-button';

export function LoginPanel({ userAgent, next }: { userAgent: string; next: string }) {
  const embedded = isInAppBrowser(userAgent);

  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) toast.error('Não foi possível entrar com Google. Tente novamente.');
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Link copiado! Cole no Chrome ou Safari.');
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-10">
      <h1 className="text-center text-3xl font-bold">Go Bingo</h1>
      {embedded ? (
        <div className="rounded-lg border p-4 text-sm" role="note">
          <p className="font-medium">Abra no navegador para entrar com Google</p>
          <p className="text-muted-foreground mt-1">O Google não permite login dentro deste app. Você ainda pode jogar como convidado.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => void copyLink()}>
              Copiar link
            </Button>
            {/Android/i.test(userAgent) && (
              <Button asChild variant="outline">
                <a href={chromeIntentUrl(typeof window === 'undefined' ? 'https://localhost' : window.location.href)}>Abrir no Chrome</a>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Button size="lg" className="w-full" onClick={() => void signInWithGoogle()}>
          Entrar com Google
        </Button>
      )}
      <GuestButton next={next} />
      <p className="text-muted-foreground text-center text-xs">Convidados jogam normalmente, mas não pontuam no ranking.</p>
    </div>
  );
}
```

`src/app/login/page.tsx`:

```tsx
import { headers } from 'next/headers';
import { LoginPanel } from '@/features/auth/login-panel';
import { safeNextPath } from '@/lib/safe-next';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, h] = await Promise.all([searchParams, headers()]);
  return <LoginPanel userAgent={h.get('user-agent') ?? ''} next={safeNextPath(next)} />;
}
```

`src/app/layout.tsx` (substituir o gerado):

```tsx
import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = { title: 'Go Bingo', description: 'Bingo multiplayer com os amigos' };

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#4c1d95',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-foreground min-h-dvh antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
```

Run: `npm test -- src/features/auth` → PASS.

- [ ] **Step 3: Commit**

```bash
npm run lint && npm run typecheck
git add src/features/auth src/app/login src/app/layout.tsx src/app/globals.css
git commit -m "feat(auth): login with Google, guest with Turnstile and in-app browser guidance"
```

---

### Task 5: Perfil — apelido no primeiro acesso, `RequireNickname`, página de erro de auth

**Files:**
- Create: `src/features/auth/nickname-form.tsx`, `src/app/apelido/page.tsx`
- Create: `src/features/profile/profile-context.tsx`, `src/app/(app)/layout.tsx`
- Create: `src/app/auth/erro/page.tsx` (o botão de trocar de conta entra no Task 10)
- Test: `src/features/auth/nickname-form.test.tsx`, `src/features/profile/profile-context.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError`, `profileSchema`, `nicknameSchema`, `isNicknameAllowed`, `suggestNickname`, `safeNextPath`, `createClient`.
- Produces: `<NicknameForm next suggestion />`, `<RequireNickname>` (provê contexto), `useProfile(): { profile: Profile; refresh(): Promise<void> }`. Páginas `/apelido?next=`, `/auth/erro?code=`.

- [ ] **Step 1: Testes falhando**

`src/features/auth/nickname-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api';
import { NicknameForm } from './nickname-form';

const apiFetch = vi.fn();
const replace = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

describe('NicknameForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prefills the suggestion and saves', async () => {
    apiFetch.mockResolvedValue({ id: 'x', nickname: 'Gustavo', isGuest: false, points: 0 });
    render(<NicknameForm next="/ABC234" suggestion="Gustavo" />);
    expect(screen.getByLabelText(/apelido/i)).toHaveValue('Gustavo');
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(apiFetch).toHaveBeenCalledWith('/me', expect.anything(), { method: 'PATCH', body: JSON.stringify({ nickname: 'Gustavo' }) });
    expect(replace).toHaveBeenCalledWith('/ABC234');
  });

  it('validates locally before calling the API', async () => {
    render(<NicknameForm next="/" suggestion="" />);
    await userEvent.type(screen.getByLabelText(/apelido/i), 'ab');
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/3 a 16/);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('shows the server message', async () => {
    apiFetch.mockRejectedValue(new ApiError(400, 'NICKNAME_INVALID', 'Apelido não permitido'));
    render(<NicknameForm next="/" suggestion="Fulano" />);
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Apelido não permitido');
  });
});
```

`src/features/profile/profile-context.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ApiError } from '@/lib/api';
import { RequireNickname, useProfile } from './profile-context';

const apiFetch = vi.fn();
const replace = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/ABC234' }));

function Name() {
  return <p>{useProfile().profile.nickname}</p>;
}

describe('RequireNickname', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders children with the profile', async () => {
    apiFetch.mockResolvedValue({ id: 'x', nickname: 'Ana', isGuest: true, points: 0 });
    render(<RequireNickname><Name /></RequireNickname>);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
  });

  it('sends users without nickname to /apelido keeping the path', async () => {
    apiFetch.mockResolvedValue({ id: 'x', nickname: null, isGuest: true, points: 0 });
    render(<RequireNickname><Name /></RequireNickname>);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/apelido?next=%2FABC234'));
  });

  it('sends expired sessions to /login', async () => {
    apiFetch.mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'x'));
    render(<RequireNickname><Name /></RequireNickname>);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2FABC234'));
  });
});
```

Run: `npm test -- src/features` → FAIL.

- [ ] **Step 2: Implementar**

`src/features/auth/nickname-form.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isNicknameAllowed, nicknameSchema, profileSchema } from '@/contracts';
import { ApiError, apiFetch } from '@/lib/api';

export function NicknameForm({ next, suggestion }: { next: string; suggestion: string }) {
  const router = useRouter();
  const [value, setValue] = useState(suggestion);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = nicknameSchema.safeParse(value);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (!isNicknameAllowed(parsed.data)) return setError('Apelido não permitido');
    setSaving(true);
    try {
      await apiFetch('/me', profileSchema, { method: 'PATCH', body: JSON.stringify({ nickname: parsed.data }) });
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar o apelido');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto flex w-full max-w-sm flex-col gap-3 px-4 py-10">
      <h1 className="text-2xl font-bold">Como quer ser chamado?</h1>
      <p className="text-muted-foreground text-sm">Os outros jogadores só veem o seu apelido.</p>
      <Label htmlFor="nickname">Apelido</Label>
      <Input id="nickname" value={value} maxLength={16} autoComplete="nickname" onChange={(e) => setValue(e.target.value)} />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={saving}>
        Continuar
      </Button>
    </form>
  );
}
```

`src/app/apelido/page.tsx`:

```tsx
import { NicknameForm } from '@/features/auth/nickname-form';
import { suggestNickname } from '@/lib/nickname';
import { safeNextPath } from '@/lib/safe-next';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function NicknamePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const fullName = (data.user?.user_metadata as { full_name?: string } | undefined)?.full_name;
  return <NicknameForm next={safeNextPath(next)} suggestion={suggestNickname(fullName)} />;
}
```

`src/features/profile/profile-context.tsx`:

```tsx
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
    setFailed(false);
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
    void load();
  }, [load]);

  if (failed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4" role="alert">
        <p>Não foi possível carregar seu perfil.</p>
        <Button onClick={() => void load()}>Tentar de novo</Button>
      </div>
    );
  }
  if (!profile) return <div className="flex min-h-dvh items-center justify-center" aria-busy="true">Carregando…</div>;
  return <ProfileContext.Provider value={{ profile, refresh: load }}>{children}</ProfileContext.Provider>;
}
```

`src/app/(app)/layout.tsx`:

```tsx
import { RequireNickname } from '@/features/profile/profile-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <RequireNickname>{children}</RequireNickname>;
}
```

`src/app/auth/erro/page.tsx`:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const MESSAGES: Record<string, string> = {
  identity_already_exists: 'Essa conta Google já tem um perfil no Go Bingo. Você pode entrar nela — o perfil de convidado atual será descartado (convidados não têm pontos a perder).',
  exchange_failed: 'Não foi possível concluir o login. Tente novamente.',
};

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = '' } = await searchParams;
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10" role="alert">
      <h1 className="text-xl font-bold">Ops!</h1>
      <p>{MESSAGES[code] ?? 'Não foi possível entrar com Google. Tente novamente.'}</p>
      <Button asChild variant="outline">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
```

Run: `npm test -- src/features` → PASS.

- [ ] **Step 3: Commit**

```bash
npm run lint && npm run typecheck
git add src/features src/app
git commit -m "feat(profile): first-access nickname, RequireNickname guard and auth error page"
```

---

### Task 6: Home — entrar por código, criar sala, lista pública ao vivo, ranking

**Files:**
- Create: `src/lib/socket.ts`
- Create: `src/features/rooms/join-by-code-form.tsx`, `src/features/rooms/create-room-form.tsx`, `src/features/rooms/use-public-rooms.ts`, `src/features/rooms/public-rooms.tsx`, `src/features/ranking/ranking-list.tsx`
- Create: `src/app/(app)/page.tsx`, `src/app/(app)/criar/page.tsx`, `src/app/(app)/ranking/page.tsx`
- Test: `src/features/rooms/join-by-code-form.test.tsx`, `src/features/rooms/create-room-form.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, contratos (`roomCodeSchema`, `createRoomSchema`, `createRoomResponseSchema`, `rankingResponseSchema`, `ServerEvents`, `ClientAckData`, `Ack`, `PublicRoom`), `getAccessToken`, `useProfile`.
- Produces: `createGameSocket(): Socket` (sem auto-connect; auth com token atual a cada (re)conexão), `emitAck<E extends keyof ClientAckData>(socket, event: E, payload?): Promise<Ack<ClientAckData[E]>>`, `usePublicRooms(): PublicRoom[] | null`, páginas `/`, `/criar`, `/ranking`.

- [ ] **Step 1: Socket compartilhado**

`src/lib/socket.ts`:

```ts
import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientAckData } from '@/contracts';
import { env } from '@/lib/env';
import { getAccessToken } from '@/lib/session';

const ACK_TIMEOUT_MS = 5_000;

export function createGameSocket(): Socket {
  return io(`${env.NEXT_PUBLIC_API_URL}/game`, {
    autoConnect: false,
    transports: ['websocket'],
    // Função: o token é relido a cada reconexão (o Supabase renova o access token).
    auth: (cb) => {
      void getAccessToken().then((token) => cb({ token }));
    },
  });
}

export async function emitAck<E extends keyof ClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<ClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<ClientAckData[E]>;
  } catch {
    return { ok: false, error: { code: 'INTERNAL', message: 'Sem resposta do servidor' } };
  }
}
```

- [ ] **Step 2: Testes falhando dos formulários**

`src/features/rooms/join-by-code-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinByCodeForm } from './join-by-code-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('JoinByCodeForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes and navigates to the room', async () => {
    render(<JoinByCodeForm />);
    await userEvent.type(screen.getByLabelText(/código da sala/i), ' abc234 ');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(push).toHaveBeenCalledWith('/ABC234');
  });

  it('rejects ambiguous characters', async () => {
    render(<JoinByCodeForm />);
    await userEvent.type(screen.getByLabelText(/código da sala/i), 'ABC0O1');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/código inválido/i);
    expect(push).not.toHaveBeenCalled();
  });
});
```

`src/features/rooms/create-room-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateRoomForm } from './create-room-form';

const apiFetch = vi.fn();
const push = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('CreateRoomForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates with defaults (15 players, public) and opens the room', async () => {
    apiFetch.mockResolvedValue({ code: 'ABC234' });
    render(<CreateRoomForm />);
    await userEvent.type(screen.getByLabelText(/nome da sala/i), 'Amigos');
    await userEvent.click(screen.getByRole('button', { name: /criar sala/i }));
    expect(apiFetch).toHaveBeenCalledWith('/rooms', expect.anything(), {
      method: 'POST',
      body: JSON.stringify({ name: 'Amigos', maxPlayers: 15, isPublic: true }),
    });
    expect(push).toHaveBeenCalledWith('/ABC234');
  });

  it('sends private rooms with the chosen size', async () => {
    apiFetch.mockResolvedValue({ code: 'ZZZ234' });
    render(<CreateRoomForm />);
    await userEvent.type(screen.getByLabelText(/nome da sala/i), 'Família');
    await userEvent.selectOptions(screen.getByLabelText(/máximo de jogadores/i), '25');
    await userEvent.click(screen.getByLabelText(/privada/i));
    await userEvent.click(screen.getByRole('button', { name: /criar sala/i }));
    expect(apiFetch.mock.calls[0][2].body).toBe(JSON.stringify({ name: 'Família', maxPlayers: 25, isPublic: false }));
  });

  it('validates the name length', async () => {
    render(<CreateRoomForm />);
    await userEvent.type(screen.getByLabelText(/nome da sala/i), 'ab');
    await userEvent.click(screen.getByRole('button', { name: /criar sala/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/mínimo de 3/i);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
```

Run: `npm test -- src/features/rooms` → FAIL.

- [ ] **Step 3: Implementar formulários, lista e páginas**

`src/features/rooms/join-by-code-form.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { roomCodeSchema } from '@/contracts';

export function JoinByCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) return setError('Código inválido');
    router.push(`/${parsed.data}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Label htmlFor="room-code">Código da sala</Label>
      <div className="flex gap-2">
        <Input id="room-code" value={code} maxLength={8} autoCapitalize="characters" autoComplete="off" className="uppercase" onChange={(e) => setCode(e.target.value)} />
        <Button type="submit">Entrar</Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
```

`src/features/rooms/create-room-form.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createRoomResponseSchema, createRoomSchema } from '@/contracts';
import { ApiError, apiFetch } from '@/lib/api';

export function CreateRoomForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('15');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = createRoomSchema.safeParse({ name, maxPlayers: Number(maxPlayers), isPublic });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setSaving(true);
    try {
      const { code } = await apiFetch('/rooms', createRoomResponseSchema, { method: 'POST', body: JSON.stringify(parsed.data) });
      router.push(`/${code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar a sala');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <Label htmlFor="room-name">Nome da sala</Label>
      <Input id="room-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />

      <Label htmlFor="max-players">Máximo de jogadores</Label>
      <select id="max-players" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} className="border-input h-11 rounded-md border bg-transparent px-3">
        <option value="10">10</option>
        <option value="15">15</option>
        <option value="25">25</option>
      </select>

      <fieldset className="flex gap-4">
        <legend className="mb-1 text-sm font-medium">Visibilidade</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="visibility" checked={isPublic} onChange={() => setIsPublic(true)} /> Pública
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="visibility" checked={!isPublic} onChange={() => setIsPublic(false)} /> Privada
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={saving}>
        Criar sala
      </Button>
    </form>
  );
}
```

`src/features/rooms/use-public-rooms.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { ServerEvents, type PublicRoom } from '@/contracts';
import { createGameSocket, emitAck } from '@/lib/socket';

export function usePublicRooms(): PublicRoom[] | null {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);

  useEffect(() => {
    const socket = createGameSocket();
    socket.on('connect', () => {
      void emitAck(socket, 'rooms:watch').then((res) => res.ok && setRooms(res.data));
    });
    socket.on(ServerEvents.ROOMS_UPDATED, (payload: { rooms: PublicRoom[] }) => setRooms(payload.rooms));
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  return rooms;
}
```

`src/features/rooms/public-rooms.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePublicRooms } from './use-public-rooms';

export function PublicRooms() {
  const rooms = usePublicRooms();
  if (rooms === null) return <p aria-busy="true">Carregando salas…</p>;
  if (rooms.length === 0) return <p className="text-muted-foreground">Nenhuma sala pública agora. Crie uma!</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rooms.map((room) => (
        <li key={room.code}>
          <Link href={`/${room.code}`} className="flex min-h-11 items-center justify-between rounded-lg border px-4 py-3">
            <span className="font-medium">{room.name}</span>
            <span className="text-muted-foreground text-sm">
              {room.playerCount}/{room.maxPlayers} · #{room.code}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

`src/features/ranking/ranking-list.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { rankingResponseSchema, type RankingResponse } from '@/contracts';
import { apiFetch } from '@/lib/api';

export function RankingList({ myUserId }: { myUserId: string }) {
  const [pages, setPages] = useState<RankingResponse[]>([]);
  const [error, setError] = useState(false);

  async function load(cursor: number) {
    try {
      const page = await apiFetch(`/ranking?cursor=${cursor}`, rankingResponseSchema);
      setPages((prev) => [...prev, page]);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    void load(0);
  }, []);

  const last = pages.at(-1);
  const me = pages[0]?.me;
  if (error) return <p role="alert">Não foi possível carregar o ranking.</p>;
  if (!last) return <p aria-busy="true">Carregando ranking…</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{me ? `Sua posição: ${me.rank}º · ${me.points} pts` : 'Entre com Google e jogue para aparecer no ranking.'}</p>
      <ol className="flex flex-col gap-1">
        {pages.flatMap((p) => p.entries).map((e) => (
          <li key={e.userId} className={`flex justify-between rounded px-3 py-2 ${e.userId === myUserId ? 'bg-primary/10 font-semibold' : ''}`}>
            <span>
              {e.rank}º {e.nickname}
            </span>
            <span>{e.points} pts</span>
          </li>
        ))}
      </ol>
      {last.nextCursor !== null && (
        <Button variant="outline" onClick={() => void load(last.nextCursor!)}>
          Carregar mais
        </Button>
      )}
    </div>
  );
}
```

`src/app/(app)/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/features/profile/profile-context';
import { JoinByCodeForm } from '@/features/rooms/join-by-code-form';
import { PublicRooms } from '@/features/rooms/public-rooms';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const { profile } = useProfile();

  async function logout() {
    await createClient().auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Go Bingo</h1>
        <span className="text-sm">
          {profile.nickname} {profile.isGuest ? '(convidado)' : `· ${profile.points} pts`}
        </span>
      </header>
      <JoinByCodeForm />
      <Button asChild size="lg">
        <Link href="/criar">Criar sala</Link>
      </Button>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Salas públicas</h2>
        <PublicRooms />
      </section>
      <nav className="flex justify-between text-sm">
        <Link href="/ranking" className="underline">
          Ranking
        </Link>
        <button onClick={() => void logout()} className="underline">
          Sair
        </button>
      </nav>
    </main>
  );
}
```

`src/app/(app)/criar/page.tsx`:

```tsx
import { CreateRoomForm } from '@/features/rooms/create-room-form';

export default function CreateRoomPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Nova sala</h1>
      <CreateRoomForm />
    </main>
  );
}
```

`src/app/(app)/ranking/page.tsx`:

```tsx
'use client';

import { useProfile } from '@/features/profile/profile-context';
import { RankingList } from '@/features/ranking/ranking-list';

export default function RankingPage() {
  const { profile } = useProfile();
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Ranking</h1>
      <RankingList myUserId={profile.id} />
    </main>
  );
}
```

Run: `npm test -- src/features/rooms` → PASS.

- [ ] **Step 4: Commit**

```bash
npm run lint && npm run typecheck
git add src/lib/socket.ts src/features/rooms src/features/ranking "src/app/(app)"
git commit -m "feat(rooms): home with join by code, create room, live public list and ranking"
```

---

### Task 7: Store do jogo — reducer puro dos eventos do servidor

**Files:**
- Create: `src/features/game/store.ts`, `src/features/game/one-away.ts`
- Test: `src/features/game/store.test.ts`, `src/features/game/one-away.test.ts`

**Interfaces:**
- Consumes: contratos (`RoomSnapshot`, `Winner`, `Card`, `ServerEventName`, `ServerEventPayloads`, `FREE_INDEX`).
- Produces:
  - `type ServerMessage = { [E in ServerEventName]: { event: E; payload: ServerEventPayloads[E] } }[ServerEventName]`
  - `type ExitReason = 'kicked' | 'host_cancelled' | 'empty' | 'not_found' | 'error'`
  - `interface GameStoreState { myUserId; snapshot: RoomSnapshot | null; connection: 'connecting' | 'online' | 'reconnecting'; winner: Winner | null; endedWithoutWinner: boolean; exit: { reason: ExitReason; message?: string } | null }`
  - `initialGameState(myUserId): GameStoreState`, `reduce(state, msg): GameStoreState`
  - `useGameStore` (Zustand) com `dispatch(msg)`, `reset(myUserId)`, `setConnection(s)`, `setExit(e)`, `setMyCard(card)`, `setMarked(marked)`
  - Seletores puros: `selectDrawnSet(state): Set<number>`, `selectCanClaim(state): boolean`, `selectIsHost(state): boolean`, `selectReadyCount(state): number`
  - `newlyOneAway(prev: Record<string, number>, next: Record<string, number>): string[]`

- [ ] **Step 1: Testes falhando**

`src/features/game/store.test.ts`:

```ts
import type { RoomSnapshot } from '@/contracts';
import { initialGameState, reduce, selectCanClaim, selectDrawnSet, selectIsHost, selectReadyCount, type GameStoreState } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));

function snapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'ABC234',
    name: 'Sala',
    hostId: ME,
    maxPlayers: 10,
    isPublic: true,
    status: 'IN_GAME',
    members: [
      { userId: ME, nickname: 'Eu', slot: 0, isGuest: false, connected: true, hasCard: true },
      { userId: ANA, nickname: 'Ana', slot: 1, isGuest: false, connected: true, hasCard: false },
    ],
    myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] },
    game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [1], drawIntervalMs: 5000, remaining: { [ME]: 23, [ANA]: 24 } },
    ...overrides,
  };
}

function withSnapshot(s = snapshot()): GameStoreState {
  return reduce(initialGameState(ME), { event: 'room:state', payload: s });
}

describe('reduce', () => {
  it('appends drawn numbers and is idempotent', () => {
    const msg = { event: 'game:number_drawn', payload: { seq: 2, number: 7, letter: 'B', drawnAt: '' } } as const;
    const once = reduce(withSnapshot(), msg);
    const twice = reduce(once, msg);
    expect(twice.snapshot!.game!.drawn).toEqual([1, 7]);
  });

  it('marks members offline on disconnect and removes them on leave', () => {
    const offline = reduce(withSnapshot(), { event: 'room:member_left', payload: { userId: ANA, reason: 'disconnected' } });
    expect(offline.snapshot!.members.find((m) => m.userId === ANA)?.connected).toBe(false);
    const gone = reduce(offline, { event: 'room:member_left', payload: { userId: ANA, reason: 'expired' } });
    expect(gone.snapshot!.members.map((m) => m.userId)).toEqual([ME]);
  });

  it('upserts joining members ordered by slot', () => {
    const left = reduce(withSnapshot(), { event: 'room:member_left', payload: { userId: ANA, reason: 'left' } });
    const back = reduce(left, {
      event: 'room:member_joined',
      payload: { member: { userId: ANA, nickname: 'Ana', slot: 1, isGuest: false, connected: true, hasCard: false }, reconnected: false },
    });
    expect(back.snapshot!.members.map((m) => m.slot)).toEqual([0, 1]);
  });

  it('flags me as kicked and handles room closure', () => {
    const kicked = reduce(withSnapshot(), { event: 'room:member_left', payload: { userId: ME, reason: 'kicked' } });
    expect(kicked.exit).toEqual({ reason: 'kicked' });
    const closed = reduce(withSnapshot(), { event: 'room:closed', payload: { reason: 'host_cancelled' } });
    expect(closed.exit).toEqual({ reason: 'host_cancelled' });
  });

  it('records the winner and room:state clears the result', () => {
    const winner = { userId: ANA, nickname: 'Ana', pointsAwarded: 20, grid };
    const won = reduce(withSnapshot(), { event: 'game:won', payload: winner });
    expect(won.winner).toEqual(winner);
    expect(won.snapshot!.status).toBe('WAITING');
    const replay = reduce(won, { event: 'room:state', payload: snapshot({ status: 'WAITING', game: null, myCard: null }) });
    expect(replay.winner).toBeNull();
  });

  it('handles host change, ready and progress', () => {
    let s = reduce(withSnapshot(), { event: 'room:host_changed', payload: { hostId: ANA } });
    s = reduce(s, { event: 'room:member_ready', payload: { userId: ANA } });
    s = reduce(s, { event: 'game:progress', payload: { remaining: { [ME]: 1, [ANA]: 2 } } });
    expect(s.snapshot!.hostId).toBe(ANA);
    expect(selectReadyCount(s)).toBe(2);
    expect(s.snapshot!.game!.remaining[ME]).toBe(1);
  });

  it('ignores events before the first snapshot', () => {
    const s = reduce(initialGameState(ME), { event: 'game:number_drawn', payload: { seq: 1, number: 7, letter: 'B', drawnAt: '' } });
    expect(s.snapshot).toBeNull();
  });
});

describe('selectors', () => {
  it('canClaim only when all 24 non-free cells are marked during a game', () => {
    const allMarked = Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== 12);
    const s = withSnapshot(snapshot({ myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: allMarked } }));
    expect(selectCanClaim(s)).toBe(true);
    expect(selectCanClaim(withSnapshot())).toBe(false);
    expect(selectCanClaim(withSnapshot(snapshot({ status: 'WAITING', myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: allMarked } })))).toBe(false);
  });

  it('exposes drawn set and host flag', () => {
    expect(selectDrawnSet(withSnapshot())).toEqual(new Set([1]));
    expect(selectIsHost(withSnapshot())).toBe(true);
  });
});
```

`src/features/game/one-away.test.ts`:

```ts
import { newlyOneAway } from './one-away';

describe('newlyOneAway', () => {
  it('returns players that just reached 1', () => {
    expect(newlyOneAway({ a: 2, b: 1, c: 3 }, { a: 1, b: 1, c: 2 })).toEqual(['a']);
  });

  it('treats unknown previous values as not one-away', () => {
    expect(newlyOneAway({}, { a: 1 })).toEqual(['a']);
  });
});
```

Run: `npm test -- src/features/game` → FAIL.

- [ ] **Step 2: Implementar**

`src/features/game/store.ts`:

```ts
import { create } from 'zustand';
import { FREE_INDEX, type Card, type Member, type RoomSnapshot, type ServerEventName, type ServerEventPayloads, type Winner } from '@/contracts';

export type ServerMessage = { [E in ServerEventName]: { event: E; payload: ServerEventPayloads[E] } }[ServerEventName];
export type ExitReason = 'kicked' | 'host_cancelled' | 'empty' | 'not_found' | 'error';
export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting';

export interface GameStoreState {
  myUserId: string | null;
  snapshot: RoomSnapshot | null;
  connection: ConnectionStatus;
  winner: Winner | null;
  endedWithoutWinner: boolean;
  exit: { reason: ExitReason; message?: string } | null;
}

export function initialGameState(myUserId: string | null): GameStoreState {
  return { myUserId, snapshot: null, connection: 'connecting', winner: null, endedWithoutWinner: false, exit: null };
}

function withMembers(snapshot: RoomSnapshot, members: Member[]): RoomSnapshot {
  return { ...snapshot, members: [...members].sort((a, b) => a.slot - b.slot) };
}

export function reduce(state: GameStoreState, msg: ServerMessage): GameStoreState {
  if (msg.event === 'room:state') return { ...state, snapshot: msg.payload, winner: null, endedWithoutWinner: false };
  if (msg.event === 'room:closed') return { ...state, exit: { reason: msg.payload.reason } };
  const s = state.snapshot;
  if (!s) return state;

  switch (msg.event) {
    case 'room:member_joined': {
      const others = s.members.filter((m) => m.userId !== msg.payload.member.userId);
      return { ...state, snapshot: withMembers(s, [...others, msg.payload.member]) };
    }
    case 'room:member_ready':
      return { ...state, snapshot: withMembers(s, s.members.map((m) => (m.userId === msg.payload.userId ? { ...m, hasCard: true } : m))) };
    case 'room:member_left': {
      const { userId, reason } = msg.payload;
      if (reason === 'disconnected') {
        return { ...state, snapshot: withMembers(s, s.members.map((m) => (m.userId === userId ? { ...m, connected: false } : m))) };
      }
      const next = { ...state, snapshot: withMembers(s, s.members.filter((m) => m.userId !== userId)) };
      return userId === state.myUserId && reason === 'kicked' ? { ...next, exit: { reason: 'kicked' } } : next;
    }
    case 'room:host_changed':
      return { ...state, snapshot: { ...s, hostId: msg.payload.hostId } };
    case 'game:number_drawn': {
      if (!s.game || s.game.drawn.includes(msg.payload.number)) return state;
      return { ...state, snapshot: { ...s, game: { ...s.game, drawn: [...s.game.drawn, msg.payload.number] } } };
    }
    case 'game:progress':
      return s.game ? { ...state, snapshot: { ...s, game: { ...s.game, remaining: msg.payload.remaining } } } : state;
    case 'game:won':
      return { ...state, winner: msg.payload, snapshot: { ...s, status: 'WAITING' } };
    case 'game:ended':
      return { ...state, endedWithoutWinner: true, snapshot: { ...s, status: 'WAITING' } };
    default:
      return state;
  }
}

export function selectDrawnSet(state: GameStoreState): Set<number> {
  return new Set(state.snapshot?.game?.drawn ?? []);
}

export function selectCanClaim(state: GameStoreState): boolean {
  const s = state.snapshot;
  if (!s || s.status !== 'IN_GAME' || !s.myCard) return false;
  return new Set(s.myCard.marked.filter((i) => i !== FREE_INDEX)).size === 24;
}

export function selectIsHost(state: GameStoreState): boolean {
  return !!state.snapshot && state.snapshot.hostId === state.myUserId;
}

export function selectReadyCount(state: GameStoreState): number {
  return state.snapshot?.members.filter((m) => m.hasCard).length ?? 0;
}

interface GameStoreActions {
  dispatch(msg: ServerMessage): void;
  reset(myUserId: string): void;
  setConnection(connection: ConnectionStatus): void;
  setExit(exit: GameStoreState['exit']): void;
  setMyCard(card: Card): void;
  setMarked(marked: number[]): void;
}

export const useGameStore = create<GameStoreState & GameStoreActions>((set) => ({
  ...initialGameState(null),
  dispatch: (msg) => set((state) => reduce(state, msg)),
  reset: (myUserId) => set(initialGameState(myUserId)),
  setConnection: (connection) => set({ connection }),
  setExit: (exit) => set({ exit }),
  setMyCard: (card) =>
    set((state) => {
      if (!state.snapshot) return state;
      const members = state.snapshot.members.map((m) => (m.userId === state.myUserId ? { ...m, hasCard: true } : m));
      return { snapshot: { ...state.snapshot, myCard: card, members } };
    }),
  setMarked: (marked) =>
    set((state) => (state.snapshot?.myCard ? { snapshot: { ...state.snapshot, myCard: { ...state.snapshot.myCard, marked } } } : state)),
}));
```

`src/features/game/one-away.ts`:

```ts
export function newlyOneAway(prev: Record<string, number>, next: Record<string, number>): string[] {
  return Object.entries(next)
    .filter(([userId, remaining]) => remaining === 1 && prev[userId] !== 1)
    .map(([userId]) => userId);
}
```

Run: `npm test -- src/features/game` → PASS.

- [ ] **Step 3: Commit**

```bash
npm run lint && npm run typecheck
git add src/features/game
git commit -m "feat(game): pure reducer for server events with zustand store and selectors"
```

---

### Task 8: Componentes de HUD — cartela, últimos números, membros, pedras, compartilhar, conexão

**Files:**
- Create: `src/features/game/card-grid.tsx`, `last-numbers.tsx`, `members-list.tsx`, `remaining-panel.tsx`, `share-code.tsx`, `connection-banner.tsx`
- Test: `src/features/game/card-grid.test.tsx`, `src/features/game/last-numbers.test.tsx`

**Interfaces:**
- Consumes: contratos (`BINGO_LETTERS`, `FREE_INDEX`, `FREE_CELL`, `letterFor`, `Member`), `ConnectionStatus`.
- Produces:
  - `<CardGrid grid marked drawn onMark? onLocked? />` (sem `onMark` = somente leitura)
  - `<LastNumbers drawn />` (atual em destaque + 4 anteriores, `aria-live`)
  - `<MembersList members hostId myUserId onKick? />`
  - `<RemainingPanel remaining members />` (dialog "Pedras que faltam")
  - `<ShareCode code />`
  - `<ConnectionBanner status />`

- [ ] **Step 1: Testes falhando**

`src/features/game/card-grid.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardGrid } from './card-grid';

// Coluna-major: B = 1..5, I = 16..20, N = 31,32,★,33,34, G = 46..50, O = 61..65
const grid = [1, 2, 3, 4, 5, 16, 17, 18, 19, 20, 31, 32, 0, 33, 34, 46, 47, 48, 49, 50, 61, 62, 63, 64, 65];

describe('CardGrid', () => {
  it('renders columns under B-I-N-G-O with the free cell in the center', () => {
    render(<CardGrid grid={grid} marked={[]} drawn={new Set()} />);
    const cells = screen.getAllByRole('button');
    // Primeira linha visual: B1, I16, N31, G46, O61.
    expect(cells.slice(0, 5).map((c) => c.textContent)).toEqual(['1', '16', '31', '46', '61']);
    expect(screen.getByRole('button', { name: /casa livre/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks a drawn number', async () => {
    const onMark = vi.fn();
    render(<CardGrid grid={grid} marked={[]} drawn={new Set([17])} onMark={onMark} />);
    await userEvent.click(screen.getByRole('button', { name: 'I 17, sorteado' }));
    expect(onMark).toHaveBeenCalledWith(6);
  });

  it('locked cell: does not mark and reports the number', async () => {
    const onMark = vi.fn();
    const onLocked = vi.fn();
    render(<CardGrid grid={grid} marked={[]} drawn={new Set()} onMark={onMark} onLocked={onLocked} />);
    await userEvent.click(screen.getByRole('button', { name: 'B 1' }));
    expect(onMark).not.toHaveBeenCalled();
    expect(onLocked).toHaveBeenCalledWith(1);
  });

  it('shows marked cells as pressed and ignores clicks on them', async () => {
    const onMark = vi.fn();
    render(<CardGrid grid={grid} marked={[0]} drawn={new Set([1])} onMark={onMark} />);
    const cell = screen.getByRole('button', { name: 'B 1, marcado' });
    expect(cell).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(cell);
    expect(onMark).not.toHaveBeenCalled();
  });
});
```

`src/features/game/last-numbers.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { LastNumbers } from './last-numbers';

describe('LastNumbers', () => {
  it('waits for the first number', () => {
    render(<LastNumbers drawn={[]} />);
    expect(screen.getByText(/aguardando o primeiro número/i)).toBeInTheDocument();
  });

  it('announces the current ball and lists the previous four', () => {
    render(<LastNumbers drawn={[3, 20, 40, 55, 70, 7]} />);
    expect(screen.getByRole('status')).toHaveTextContent('B 7');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['O70', 'G55', 'N40', 'I20']);
  });
});
```

Run: `npm test -- src/features/game` → FAIL.

- [ ] **Step 2: Implementar**

`src/features/game/card-grid.tsx`:

```tsx
'use client';

import { BINGO_LETTERS, FREE_CELL, FREE_INDEX, letterFor } from '@/contracts';
import { cn } from '@/lib/utils';

interface CardGridProps {
  grid: readonly number[];
  marked: readonly number[];
  drawn: ReadonlySet<number>;
  onMark?: (index: number) => void;
  onLocked?: (number: number) => void;
}

export function CardGrid({ grid, marked, drawn, onMark, onLocked }: CardGridProps) {
  const markedSet = new Set(marked);
  const cells: number[] = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) cells.push(col * 5 + row);

  return (
    <div className="mx-auto grid w-full max-w-md touch-manipulation grid-cols-5 gap-1.5 select-none">
      {BINGO_LETTERS.map((letter) => (
        <div key={letter} className="text-primary text-center text-lg font-black" aria-hidden="true">
          {letter}
        </div>
      ))}
      {cells.map((index) => {
        const number = grid[index];
        const free = index === FREE_INDEX || number === FREE_CELL;
        const isMarked = free || markedSet.has(index);
        const isDrawn = !free && drawn.has(number);
        const label = free ? 'Casa livre' : `${letterFor(number)} ${number}${isMarked ? ', marcado' : isDrawn ? ', sorteado' : ''}`;

        function click() {
          if (free || isMarked || !onMark) return;
          if (!isDrawn) return onLocked?.(number);
          onMark(index);
        }

        return (
          <button
            key={index}
            type="button"
            aria-label={label}
            aria-pressed={isMarked}
            onClick={click}
            className={cn(
              'flex aspect-square min-h-11 min-w-11 items-center justify-center rounded-md border text-lg font-bold transition-colors',
              isMarked && 'bg-primary text-primary-foreground border-primary',
              !isMarked && isDrawn && 'border-primary ring-primary/60 animate-pulse ring-2',
              !isMarked && !isDrawn && 'bg-muted/40 text-foreground/80',
            )}
          >
            {free ? '★' : number}
          </button>
        );
      })}
    </div>
  );
}
```

`src/features/game/last-numbers.tsx`:

```tsx
import { letterFor } from '@/contracts';

export function LastNumbers({ drawn }: { drawn: readonly number[] }) {
  const current = drawn.at(-1);
  const previous = drawn.slice(-5, -1).reverse();

  return (
    <div className="flex flex-col items-center gap-3">
      <div role="status" aria-live="polite" className="bg-primary text-primary-foreground flex size-28 flex-col items-center justify-center rounded-full shadow-lg">
        {current === undefined ? (
          <span className="px-3 text-center text-sm">Aguardando o primeiro número</span>
        ) : (
          <>
            <span className="text-lg font-bold">{letterFor(current)}</span>
            <span className="sr-only"> </span>
            <span className="text-5xl leading-none font-black">{current}</span>
          </>
        )}
      </div>
      {previous.length > 0 && (
        <ol aria-label="Números anteriores" className="flex gap-2">
          {previous.map((n) => (
            <li key={n} className="bg-muted flex size-11 items-center justify-center rounded-full text-sm font-bold">
              {letterFor(n)}
              {n}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

`src/features/game/members-list.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import type { Member } from '@/contracts';

interface MembersListProps {
  members: Member[];
  hostId: string;
  myUserId: string;
  onKick?: (userId: string) => void;
}

export function MembersList({ members, hostId, myUserId, onKick }: MembersListProps) {
  return (
    <ul className="flex flex-col gap-1" aria-label="Jogadores na sala">
      {members.map((m) => (
        <li key={m.userId} className={`flex min-h-11 items-center justify-between gap-2 rounded px-3 ${m.connected ? '' : 'opacity-50'}`}>
          <span className="truncate">
            {m.userId === hostId && <span aria-label="host">👑 </span>}
            {m.nickname}
            {m.userId === myUserId && ' (você)'}
            {!m.connected && ' · reconectando'}
          </span>
          <span className="flex items-center gap-2">
            {m.hasCard && <Badge variant="secondary">pronto</Badge>}
            {onKick && m.userId !== myUserId && (
              <button className="text-destructive min-h-11 px-2 text-sm underline" onClick={() => onKick(m.userId)}>
                Remover
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

`src/features/game/remaining-panel.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Member } from '@/contracts';

export function RemainingPanel({ remaining, members }: { remaining: Record<string, number>; members: Member[] }) {
  const names = new Map(members.map((m) => [m.userId, m.nickname]));
  const rows = Object.entries(remaining).sort(([, a], [, b]) => a - b);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          Pedras que faltam
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedras que faltam</DialogTitle>
        </DialogHeader>
        <ol className="flex flex-col gap-1">
          {rows.map(([userId, left]) => (
            <li key={userId} className={`flex justify-between rounded px-3 py-2 ${left === 1 ? 'bg-amber-500/15 font-semibold' : ''}`}>
              <span>{names.get(userId) ?? 'Jogador que saiu'}</span>
              <span>{left === 1 ? 'por 1!' : left}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
```

`src/features/game/share-code.tsx`:

```tsx
'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function ShareCode({ code }: { code: string }) {
  async function share() {
    const url = `${window.location.origin}/${code}`;
    if (navigator.share) {
      await navigator.share({ title: 'Go Bingo', text: `Bora jogar bingo! Sala ${code}`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Link da sala copiado!');
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <p>
        Código <strong className="font-mono text-xl tracking-widest">{code}</strong>
      </p>
      <Button variant="outline" onClick={() => void share()}>
        Compartilhar
      </Button>
    </div>
  );
}
```

`src/features/game/connection-banner.tsx`:

```tsx
import type { ConnectionStatus } from './store';

export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status !== 'reconnecting') return null;
  return (
    <div role="status" className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black">
      Reconectando…
    </div>
  );
}
```

Run: `npm test -- src/features/game` → PASS.

- [ ] **Step 3: Commit**

```bash
npm run lint && npm run typecheck
git add src/features/game
git commit -m "feat(game): accessible HUD components for card, draws, members and status"
```

---

### Task 9: Tela da sala — conexão, lobby e partida (layout mobile-first)

**Files:**
- Create: `src/features/game/use-game-connection.ts`, `lobby-view.tsx`, `game-view.tsx`, `room-screen.tsx`, `src/app/(app)/[code]/page.tsx`
- Test: `src/features/game/game-view.test.tsx`

**Interfaces:**
- Consumes: `createGameSocket`, `emitAck`, `useGameStore` + seletores, `newlyOneAway`, componentes do Task 8, `useProfile`, contratos (`ServerEvents`, `roomCodeSchema`).
- Produces:
  - `useGameConnection(code): GameActions` com `GameActions = { generateCard(); start(); cancel(); leave(); kick(userId); mark(index); claim(); replay() }` — cada um `Promise<void>`, mostrando toast em erro.
  - `<LobbyView actions />`, `<GameView actions />`, `<RoomScreen code />`; rota `/[code]`.

- [ ] **Step 1: Teste falhando da GameView (habilitação do BINGO e marcação)**

`src/features/game/game-view.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoomSnapshot } from '@/contracts';
import { GameView } from './game-view';
import { initialGameState, reduce, useGameStore } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));

function load(marked: number[]) {
  const snapshot: RoomSnapshot = {
    code: 'ABC234', name: 'Sala', hostId: ME, maxPlayers: 10, isPublic: true, status: 'IN_GAME',
    members: [{ userId: ME, nickname: 'Eu', slot: 0, isGuest: false, connected: true, hasCard: true }],
    myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked },
    game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: grid.filter((n) => n !== 0), drawIntervalMs: 5000, remaining: { [ME]: 0 } },
  };
  useGameStore.setState(reduce(initialGameState(ME), { event: 'room:state', payload: snapshot }));
}

const actions = { generateCard: vi.fn(), start: vi.fn(), cancel: vi.fn(), leave: vi.fn(), kick: vi.fn(), mark: vi.fn(), claim: vi.fn(), replay: vi.fn() };

describe('GameView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps BINGO disabled until every cell is marked', () => {
    load([0, 1]);
    render(<GameView actions={actions} />);
    expect(screen.getByRole('button', { name: /bingo/i })).toBeDisabled();
  });

  it('enables BINGO and claims', async () => {
    load(Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== 12));
    render(<GameView actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: /bingo/i }));
    expect(actions.claim).toHaveBeenCalled();
  });

  it('marks through the actions', async () => {
    load([]);
    render(<GameView actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: 'B 1, sorteado' }));
    expect(actions.mark).toHaveBeenCalledWith(0);
  });
});
```

Run: `npm test -- src/features/game/game-view` → FAIL.

- [ ] **Step 2: Hook de conexão**

`src/features/game/use-game-connection.ts`:

```ts
'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { ServerEvents, type Ack, type ClientAckData } from '@/contracts';
import { createGameSocket, emitAck } from '@/lib/socket';
import { useGameStore, type ServerMessage } from './store';

export interface GameActions {
  generateCard(): Promise<void>;
  start(): Promise<void>;
  cancel(): Promise<void>;
  leave(): Promise<void>;
  kick(userId: string): Promise<void>;
  mark(index: number): Promise<void>;
  claim(): Promise<void>;
  replay(): Promise<void>;
}

function report<T>(res: Ack<T>): res is { ok: true; data: T } {
  if (!res.ok) toast.error(res.error.message);
  return res.ok;
}

export function useGameConnection(code: string): GameActions {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;
    const socket = createGameSocket();
    socketRef.current = socket;
    const { dispatch, setConnection, setExit } = useGameStore.getState();

    for (const event of Object.values(ServerEvents)) {
      socket.on(event, (payload: unknown) => dispatch({ event, payload } as ServerMessage));
    }
    socket.on('connect', () => {
      void emitAck(socket, 'room:join', { code }).then((res) => {
        if (!active) return;
        if (res.ok) {
          dispatch({ event: 'room:state', payload: res.data });
          setConnection('online');
        } else {
          setExit({ reason: res.error.code === 'NOT_FOUND' ? 'not_found' : 'error', message: res.error.message });
        }
      });
    });
    socket.on('disconnect', () => setConnection('reconnecting'));
    socket.on('connect_error', (error) => {
      if (error.message === 'UNAUTHENTICATED') setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' });
      else setConnection('reconnecting');
    });
    socket.connect();

    return () => {
      active = false;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  return useMemo<GameActions>(() => {
    const call = <E extends keyof ClientAckData>(event: E, payload: object = {}): Promise<Ack<ClientAckData[E]>> => {
      const socket = socketRef.current;
      if (!socket) return Promise.resolve({ ok: false, error: { code: 'INTERNAL', message: 'Sem conexão' } });
      return emitAck(socket, event, payload);
    };
    const store = () => useGameStore.getState();
    return {
      generateCard: async () => {
        const res = await call('card:generate');
        if (report(res)) store().setMyCard(res.data);
      },
      start: async () => void report(await call('game:start')),
      cancel: async () => void report(await call('room:cancel')),
      leave: async () => void report(await call('room:leave')),
      kick: async (userId) => void report(await call('room:kick', { userId })),
      mark: async (index) => {
        const res = await call('card:mark', { index });
        if (report(res)) store().setMarked(res.data.marked);
      },
      claim: async () => void report(await call('bingo:claim')),
      replay: async () => void report(await call('game:replay')),
    };
  }, []);
}
```

- [ ] **Step 3: Views**

`src/features/game/lobby-view.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { MAX_CARD_REGENS } from '@/contracts';
import { CardGrid } from './card-grid';
import type { GameActions } from './use-game-connection';
import { MembersList } from './members-list';
import { ShareCode } from './share-code';
import { selectIsHost, selectReadyCount, useGameStore } from './store';

export function LobbyView({ actions, onLeave }: { actions: GameActions; onLeave: () => void }) {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const myUserId = useGameStore((s) => s.myUserId)!;
  const isHost = useGameStore(selectIsHost);
  const ready = useGameStore(selectReadyCount);
  const canStart = snapshot.members.length >= 2 && ready >= 2;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header>
        <h1 className="text-xl font-bold">{snapshot.name}</h1>
        <p className="text-muted-foreground text-sm">
          {snapshot.members.length}/{snapshot.maxPlayers} jogadores · {ready} prontos
        </p>
      </header>
      <ShareCode code={snapshot.code} />
      <MembersList members={snapshot.members} hostId={snapshot.hostId} myUserId={myUserId} onKick={isHost ? (id) => void actions.kick(id) : undefined} />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Sua cartela</h2>
        {snapshot.myCard ? (
          <CardGrid grid={snapshot.myCard.grid} marked={[]} drawn={new Set()} />
        ) : (
          <p className="text-muted-foreground text-sm">Gere uma cartela para ficar pronto. Se não gerar, recebe uma automática no início.</p>
        )}
        <Button variant="secondary" onClick={() => void actions.generateCard()}>
          {snapshot.myCard ? `Trocar cartela (até ${MAX_CARD_REGENS}x)` : 'Gerar cartela'}
        </Button>
      </section>

      {isHost ? (
        <div className="flex flex-col gap-2">
          <Button size="lg" disabled={!canStart} onClick={() => void actions.start()}>
            {canStart ? 'Iniciar partida' : 'Aguardando 2 jogadores prontos'}
          </Button>
          <Button variant="ghost" className="text-destructive" onClick={() => void actions.cancel()}>
            Cancelar sala
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={onLeave}>
          Sair da sala
        </Button>
      )}
    </main>
  );
}
```

`src/features/game/game-view.tsx`:

```tsx
'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { letterFor } from '@/contracts';
import { CardGrid } from './card-grid';
import { LastNumbers } from './last-numbers';
import { RemainingPanel } from './remaining-panel';
import { selectCanClaim, useGameStore } from './store';
import type { GameActions } from './use-game-connection';

/**
 * Layout: retrato = palco (topo) / cartela / barra fixa; paisagem = palco | cartela+barra.
 * A <section data-stage> é onde o canvas 3D entra nos marcos M3/M4; hoje ela é o "modo 2D".
 */
export function GameView({ actions }: { actions: GameActions }) {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const canClaim = useGameStore(selectCanClaim);
  const drawn = snapshot.game?.drawn ?? [];
  const card = snapshot.myCard;

  return (
    <main className="grid h-dvh grid-rows-[minmax(0,2fr)_minmax(0,3fr)_auto] landscape:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] landscape:grid-rows-[minmax(0,1fr)_auto]">
      <section data-stage className="flex items-center justify-center overflow-hidden p-2 landscape:row-span-2">
        <LastNumbers drawn={drawn} />
      </section>
      <section className="flex items-center overflow-y-auto px-3">
        {card && (
          <CardGrid
            grid={card.grid}
            marked={card.marked}
            drawn={new Set(drawn)}
            onMark={(index) => void actions.mark(index)}
            onLocked={(n) => toast(`${letterFor(n)} ${n} ainda não saiu`)}
          />
        )}
      </section>
      <footer className="bg-background/95 flex gap-2 border-t px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <RemainingPanel remaining={snapshot.game?.remaining ?? {}} members={snapshot.members} />
        <Button size="lg" className="flex-1 text-lg font-black" disabled={!canClaim} onClick={() => void actions.claim()}>
          BINGO!
        </Button>
      </footer>
    </main>
  );
}
```

Run: `npm test -- src/features/game/game-view` → PASS.

- [ ] **Step 4: RoomScreen e rota**

`src/features/game/room-screen.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/features/profile/profile-context';
import { ConnectionBanner } from './connection-banner';
import { GameView } from './game-view';
import { LobbyView } from './lobby-view';
import { newlyOneAway } from './one-away';
import { useGameStore } from './store';
import { useGameConnection } from './use-game-connection';

const EXIT_MESSAGES = {
  kicked: 'O host removeu você da sala.',
  host_cancelled: 'A sala foi encerrada pelo host.',
  empty: 'A sala foi encerrada.',
  not_found: 'Sala não encontrada.',
  error: 'Não foi possível entrar na sala.',
} as const;

export function RoomScreen({ code }: { code: string }) {
  const { profile } = useProfile();
  const router = useRouter();
  const reset = useGameStore((s) => s.reset);
  useEffect(() => reset(profile.id), [reset, profile.id]);

  const actions = useGameConnection(code);
  const snapshot = useGameStore((s) => s.snapshot);
  const connection = useGameStore((s) => s.connection);
  const exit = useGameStore((s) => s.exit);
  const showResult = useGameStore((s) => s.winner !== null || s.endedWithoutWinner);

  // "Fulano está por 1!"
  const prevRemaining = useRef<Record<string, number>>({});
  const remaining = snapshot?.game?.remaining;
  useEffect(() => {
    if (!remaining || !snapshot) return;
    for (const userId of newlyOneAway(prevRemaining.current, remaining)) {
      const nick = snapshot.members.find((m) => m.userId === userId)?.nickname;
      if (nick) toast(userId === profile.id ? 'Você está por 1!' : `${nick} está por 1!`);
    }
    prevRemaining.current = remaining;
  }, [remaining, snapshot, profile.id]);

  async function leave() {
    await actions.leave();
    router.push('/');
  }

  if (exit) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10" role="alert">
        <p>{exit.message ?? EXIT_MESSAGES[exit.reason]}</p>
        <Button asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
      </main>
    );
  }
  if (!snapshot) return <div className="flex h-dvh items-center justify-center" aria-busy="true">Entrando na sala…</div>;

  return (
    <>
      <ConnectionBanner status={connection} />
      {snapshot.status === 'IN_GAME' || showResult ? <GameView actions={actions} /> : <LobbyView actions={actions} onLeave={() => void leave()} />}
    </>
  );
}
```

(Até o Task 10, ao fim da partida a tela continua na `GameView` com o BINGO! desabilitado; o diálogo de resultado entra no Task 10.)

`src/app/(app)/[code]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { roomCodeSchema } from '@/contracts';
import { RoomScreen } from '@/features/game/room-screen';

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  return <RoomScreen code={parsed.data} />;
}
```

- [ ] **Step 5: Rodar e commit**

Run: `npm run lint && npm run typecheck && npm test`
Expected: tudo verde.

```bash
git add src/features/game "src/app/(app)/[code]"
git commit -m "feat(game): room screen with socket connection, lobby and mobile-first game view"
```

---

### Task 10: Resultado da partida, jogar de novo e upgrade de convidado para Google

**Files:**
- Create: `src/features/auth/upgrade-button.tsx`, `src/features/game/result-dialog.tsx`
- Modify: `src/features/game/room-screen.tsx` (renderiza o diálogo), `src/app/auth/erro/page.tsx` (botão de trocar de conta), `src/app/(app)/page.tsx` (CTA de upgrade para convidado)
- Test: `src/features/auth/upgrade-button.test.tsx`, `src/features/game/result-dialog.test.tsx`

**Interfaces:**
- Consumes: `createClient`, `useGameStore`, `selectIsHost`, `useProfile`, `WIN_POINTS`.
- Produces: `<UpgradeButton />` (`linkIdentity` Google, mantém o caminho atual), `<SwitchToGoogleAccount />` (signOut + login Google), `<ResultDialog onReplay onLeave />`.

- [ ] **Step 1: Testes falhando**

`src/features/auth/upgrade-button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpgradeButton } from './upgrade-button';

const linkIdentity = vi.fn();
const push = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { linkIdentity } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/ABC234' }));

describe('UpgradeButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links Google returning to the current page', async () => {
    linkIdentity.mockResolvedValue({ data: {}, error: null });
    render(<UpgradeButton />);
    await userEvent.click(screen.getByRole('button', { name: /entrar com google para salvar/i }));
    expect(linkIdentity).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2FABC234` },
    });
  });

  it('identity_already_exists goes to the explanation page', async () => {
    linkIdentity.mockResolvedValue({ data: null, error: { code: 'identity_already_exists', message: 'x' } });
    render(<UpgradeButton />);
    await userEvent.click(screen.getByRole('button', { name: /entrar com google para salvar/i }));
    expect(push).toHaveBeenCalledWith('/auth/erro?code=identity_already_exists');
  });
});
```

`src/features/game/result-dialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoomSnapshot } from '@/contracts';
import { ResultDialog } from './result-dialog';
import { initialGameState, reduce, useGameStore } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));
let isGuest = false;

vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({ profile: { id: ME, nickname: 'Eu', isGuest, points: 0 }, refresh: vi.fn() }),
}));
vi.mock('@/features/auth/upgrade-button', () => ({ UpgradeButton: () => <button>upgrade</button> }));

function setup(hostId: string, winnerId: string | null) {
  const snapshot: RoomSnapshot = {
    code: 'ABC234', name: 'Sala', hostId, maxPlayers: 10, isPublic: true, status: 'IN_GAME',
    members: [], myCard: null, game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [], drawIntervalMs: 5000, remaining: {} },
  };
  let state = reduce(initialGameState(ME), { event: 'room:state', payload: snapshot });
  state = winnerId
    ? reduce(state, { event: 'game:won', payload: { userId: winnerId, nickname: winnerId === ME ? 'Eu' : 'Ana', pointsAwarded: winnerId === ME && !isGuest ? 20 : 0, grid } })
    : reduce(state, { event: 'game:ended', payload: { reason: 'exhausted' } });
  useGameStore.setState(state);
}

describe('ResultDialog', () => {
  beforeEach(() => {
    isGuest = false;
  });

  it('registered winner sees the points', () => {
    setup(ME, ME);
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText(/você venceu/i)).toBeInTheDocument();
    expect(screen.getByText(/\+20 pontos/i)).toBeInTheDocument();
  });

  it('guest winner sees the upgrade CTA', () => {
    isGuest = true;
    setup(ME, ME);
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'upgrade' })).toBeInTheDocument();
  });

  it('others see who won; only the host can replay', async () => {
    const onReplay = vi.fn();
    setup(ANA, ANA);
    render(<ResultDialog onReplay={onReplay} onLeave={vi.fn()} />);
    expect(screen.getByText(/ana fez bingo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /jogar de novo/i })).not.toBeInTheDocument();
  });

  it('host can replay after a game without winner', async () => {
    const onReplay = vi.fn();
    setup(ME, null);
    render(<ResultDialog onReplay={onReplay} onLeave={vi.fn()} />);
    expect(screen.getByText(/sem vencedor/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /jogar de novo/i }));
    expect(onReplay).toHaveBeenCalled();
  });
});
```

Run: `npm test -- src/features/auth/upgrade src/features/game/result` → FAIL.

- [ ] **Step 2: Implementar**

`src/features/auth/upgrade-button.tsx`:

```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function UpgradeButton() {
  const router = useRouter();
  const pathname = usePathname();

  async function upgrade() {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(pathname)}`;
    const { error } = await createClient().auth.linkIdentity({ provider: 'google', options: { redirectTo } });
    if (!error) return;
    if (error.code === 'identity_already_exists') return router.push('/auth/erro?code=identity_already_exists');
    toast.error('Não foi possível vincular sua conta Google.');
  }

  return (
    <Button onClick={() => void upgrade()} className="w-full">
      Entrar com Google para salvar seus pontos
    </Button>
  );
}

/** Usado quando o Google já tem perfil: descarta o convidado e entra na conta existente. */
export function SwitchToGoogleAccount() {
  async function switchAccount() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=%2F` } });
  }

  return (
    <Button onClick={() => void switchAccount()} className="w-full">
      Entrar na conta Google existente
    </Button>
  );
}
```

Em `src/app/auth/erro/page.tsx`, adicionar `import { SwitchToGoogleAccount } from '@/features/auth/upgrade-button';` e, logo após o `<p>` da mensagem:

```tsx
{code === 'identity_already_exists' && <SwitchToGoogleAccount />}
```

(Server Component pode renderizar o componente client; `upgrade-button.tsx` já tem `'use client'`.)

Em `src/features/game/room-screen.tsx`, adicionar `import { ResultDialog } from './result-dialog';` e, logo após a linha da `GameView`/`LobbyView`:

```tsx
{showResult && <ResultDialog onReplay={() => void actions.replay()} onLeave={() => void leave()} />}
```

`src/features/game/result-dialog.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UpgradeButton } from '@/features/auth/upgrade-button';
import { useProfile } from '@/features/profile/profile-context';
import { selectIsHost, useGameStore } from './store';

export function ResultDialog({ onReplay, onLeave }: { onReplay: () => void; onLeave: () => void }) {
  const { profile } = useProfile();
  const winner = useGameStore((s) => s.winner);
  const isHost = useGameStore(selectIsHost);
  const iWon = winner?.userId === profile.id;

  const title = winner ? (iWon ? 'Você venceu! 🎉' : `${winner.nickname} fez BINGO!`) : 'Fim de jogo';
  const description = winner
    ? iWon
      ? profile.isGuest
        ? 'Convidados não pontuam no ranking.'
        : `+${winner.pointsAwarded} pontos no ranking.`
      : 'Não foi dessa vez.'
    : 'Todos os números saíram sem vencedor.';

  return (
    <Dialog open>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {iWon && profile.isGuest && <UpgradeButton />}
        <div className="flex flex-col gap-2">
          {isHost ? (
            <Button size="lg" onClick={onReplay}>
              Jogar de novo
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">Aguardando o host começar outra rodada…</p>
          )}
          <Button variant="outline" onClick={onLeave}>
            Sair
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Em `src/app/(app)/page.tsx`, logo após o `<header>`, para convidados:

```tsx
{profile.isGuest && <UpgradeButton />}
```

(com `import { UpgradeButton } from '@/features/auth/upgrade-button';`).

Run: `npm test` → PASS (suite inteira).

- [ ] **Step 3: Commit**

```bash
npm run lint && npm run typecheck
git add src
git commit -m "feat(game): result dialog with replay and guest-to-Google upgrade"
```

---

### Task 11: Verificação ponta a ponta manual (front + back + Supabase)

**Files:**
- Modify: `README.md` (seção "Rodando o Go Bingo Front" no topo)

Pré-requisitos: back do plano 1 completo rodando (`npm run start:dev` em `go-bingo-back`), Supabase configurado conforme o Roadmap, `.env.local` preenchido.

- [ ] **Step 1: README**

Adicionar no topo do `README.md`:

````markdown
## Rodando o Go Bingo Front

```bash
cp .env.example .env.local    # Supabase URL/publishable key do seu projeto; API em http://localhost:3333
npm install
npm run dev                   # http://localhost:3000
```

Testes: `npm test`. Contratos (`src/contracts`) são gerados pelo back: `cd ../go-bingo-back && npm run contracts:sync`.
````

- [ ] **Step 2: Build de produção**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 3: Roteiro manual (3 sessões: Chrome normal, Chrome anônimo, celular ou DevTools em modo dispositivo 360×740)**

Marque cada item:

- [ ] Sessão A: `/` sem login → redireciona para `/login?next=%2F`. "Entrar com Google" → volta logado → `/apelido` com primeiro nome sugerido → salva → Home.
- [ ] Sessão A: cria sala pública "Teste" (10) → abre `/CODIGO`, aparece como host 👑, "Compartilhar" copia o link.
- [ ] Sessão B (anônima): abre o link da sala → `/login?next=/CODIGO` → "Jogar como convidado" → captcha → apelido → entra direto na sala. A vê B entrar sem recarregar.
- [ ] Sessão C (dispositivo 360 px): Home mostra a sala na lista pública com `2/10` e atualiza sozinha quando C entra (`3/10`).
- [ ] B gera e troca a cartela; a 6ª troca mostra "Você já trocou a cartela 5 vezes". Colunas da cartela respeitam B 1–15 … O 61–75 com ★ no centro.
- [ ] A só vê "Iniciar partida" habilitado com 2 prontos; B e C não veem o botão.
- [ ] A inicia → todos vão para a partida; C (sem cartela) recebe uma automática.
- [ ] Números aparecem a cada ~5 s nas três sessões; leitor de tela (ou inspeção do `role="status"`) anuncia "B 7" etc.
- [ ] Tocar numa pedra não sorteada mostra "… ainda não saiu" e não marca; duplo toque não dá zoom.
- [ ] "Pedras que faltam" mostra os três jogadores; toast "Fulano está por 1!" aparece.
- [ ] Em C, desligar a rede (DevTools → Offline) por 10 s → banner "Reconectando…"; A vê C "reconectando"; ao voltar, C continua com as mesmas marcações.
- [ ] Reiniciar o back no meio da partida (`Ctrl+C` + `npm run start:dev`) → clientes reconectam e o sorteio continua sem repetir número.
- [ ] Quem completa a cartela vê BINGO! habilitado; ao pedir, todos veem o resultado; conta Google recebe +20 (conferir na Home/ranking); convidado vê o botão de salvar com Google.
- [ ] Convidado vencedor clica "Entrar com Google para salvar seus pontos" com um Google **novo** → volta para a sala, Home mostra pontos (não mais "convidado").
- [ ] Repetir o upgrade com um Google que **já** tem perfil → página explicativa com "Entrar na conta Google existente".
- [ ] Host clica "Jogar de novo" → todos voltam ao lobby sem cartela; a sala reaparece na lista pública.
- [ ] Host remove B → B vê "O host removeu você da sala."; host cancela a sala → todos veem "A sala foi encerrada pelo host."
- [ ] Rotacionar o celular/DevTools para paisagem na partida → palco à esquerda, cartela à direita, nada cortado; em retrato a barra inferior respeita a área segura.
- [ ] Abrir o link com user-agent do Instagram (DevTools → Network conditions → custom UA `Instagram 300.0`) → "Abra no navegador", sem botão do Google, convidado disponível.
- [ ] `/ranking` lista as contas Google com partidas, destaca você e mostra a sua posição; convidado vê o convite para entrar com Google.

- [ ] **Step 4: Registrar o resultado e commit**

Anote no PR/commit os itens que falharam (com passo a passo) em vez de marcá-los. Corrija bugs encontrados com `superpowers:systematic-debugging` antes de considerar o M1 entregue.

```bash
git add README.md
git commit -m "docs: front run instructions and M1 manual verification"
```

---

### Task 12: Gate de cobertura de testes unitários (constituição, Princípio VIII)

**Files:**
- Create: `vitest.config.mts` (modify — adiciona `coverage`)
- Modify: `package.json` (script `test:cov`), `.github/workflows/ci.yml` (roda com cobertura)
- Create (só se a Step 2 achar lacuna real): testes unitários adicionais para fechar o limiar

**Interfaces:**
- Consumes: a suíte Vitest existente das Tasks 1–11 (nenhuma interface nova).
- Produces: `npm run test:cov` (local), CI falhando build com cobertura <80%.

- [ ] **Step 1: Instalar o provider e configurar o limiar**

```bash
npm install -D @vitest/coverage-v8
```

Em `vitest.config.mts`, acrescentar `coverage` dentro de `test`:

```ts
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.local',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      NEXT_PUBLIC_API_URL: 'http://api.test',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/contracts/**', 'src/app/**/layout.tsx', 'src/app/**/page.tsx', '**/*.test.{ts,tsx}', '**/*.d.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
```

(`src/app/**/page.tsx`/`layout.tsx` saem do cálculo porque já são exercitados pelo roteiro manual do Task 11 — são composição fina de componentes já testados isoladamente, não lógica nova. Toda `page.tsx` com lógica própria, não só composição, entra na exceção só se o Step 2 mostrar que vale a pena testá-la isolada; o padrão é incluir.)

Em `package.json` → `"scripts"`:

```json
"test:cov": "vitest run --coverage"
```

- [ ] **Step 2: Rodar e medir a lacuna real**

Run: `npm run test:cov`
Expected: relatório de cobertura. Se as quatro métricas globais já estiverem ≥80%, siga para o Step 4. Se não, o relatório lista os arquivos abaixo do limiar — vá ao Step 3.

- [ ] **Step 3: Fechar lacunas reais com teste, nunca abaixando o limiar**

Para cada arquivo de lógica (não puramente apresentacional) abaixo do limiar: escreva o teste que faltou, verificando comportamento real — não um teste que só força a linha a executar. Candidatos esperados, dado o histórico das tasks: ramos de erro pouco exercitados em `use-game-connection.ts` (Task 9, ex.: `connect_error` com mensagem diferente de `UNAUTHENTICATED`), `room-screen.tsx`'s branch de `exit.message` vs. `EXIT_MESSAGES[exit.reason]` (Task 9). Para um arquivo puramente apresentacional sem decisão (ex.: um componente que só recebe props e renderiza), se ele ainda assim puxar a métrica para baixo, documente a exceção com `// coverage: justificativa` e registre no `README.md` (Step 4) em vez de inflar a cobertura com teste vazio — deve ser raro.

Run: `npm run test:cov`
Expected: as quatro métricas globais ≥80%.

- [ ] **Step 4: CI roda com cobertura e documentação**

Em `.github/workflows/ci.yml`, troque `- run: npm test` por:

```yaml
      - run: npm run test:cov
```

Em `README.md`, na seção "Rodando o Go Bingo Front" (criada na Task 11), acrescentar:

```markdown
Cobertura mínima: 80% (statements/branches/functions/lines), conforme a constituição do projeto (Princípio VIII). `npm run test:cov` roda local; o CI falha a build abaixo do limiar.
```

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run typecheck && npm run test:cov && npm run build
```

Expected: tudo verde, cobertura ≥80% nas quatro métricas.

```bash
git add package.json vitest.config.mts .github/workflows/ci.yml README.md src
git commit -m "test: enforce 80% unit test coverage gate in CI (constitution principle VIII)"
```

---

## Cobertura do PRD (auto-revisão)

| PRD | Onde |
|---|---|
| US-1.1 login Google + voltar à sala | Tasks 3, 4 |
| US-1.2 apelido no primeiro acesso, nome do Google oculto | Tasks 2, 5 |
| US-1.3 navegador embutido | Tasks 2, 4 |
| US-1.4 convidado com CAPTCHA | Task 4 |
| US-1.5 convidado → Google, conflito de identidade | Tasks 5, 10 |
| US-3.1/3.2 criar, entrar por código/link/lista ao vivo | Task 6 |
| US-3.3 lista de jogadores na HUD (fila 3D no M3) | Tasks 8, 9 |
| US-3.4/3.5 cartela, pronto, iniciar | Task 9 |
| US-3.7 cancelar, remover | Tasks 8, 9 |
| US-4.1 número na HUD imediato, aria-live | Task 8 |
| US-4.2 marcação, ≥44 px, sem zoom | Task 8 |
| US-4.3 pedras que faltam, "por 1" | Tasks 7, 8, 9 |
| US-4.4 BINGO!, resultado | Tasks 7, 9, 10 |
| US-4.5 reconexão com banner | Tasks 7, 9 |
| US-4.6 jogar de novo | Task 10 |
| US-5.1 ranking | Task 6 |
| US-6.3 layouts retrato/paisagem, safe-area, dvh | Task 9 (base); refinamentos no M2 |
| Constituição VIII — cobertura ≥80% | Task 12 |
| Fora deste plano | US-6.1/6.2 PWA e wake lock (M2), cenas 3D e níveis de qualidade (M3/M4), Playwright/Sentry (M5) |
