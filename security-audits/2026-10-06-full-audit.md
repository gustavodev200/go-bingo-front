# Security Audit Report — 2026-10-06 (go-bingo-front)

Processo: `.claude/commands/security-audit.md` + `.claude/skills/security/references/full-audit.md`.
Branch auditada: `feat/m5-launch` (HEAD antes das correções: `9588c9e`).
Preset: `prisma-postgres`, front Next.js 16.3.8 + Supabase Auth (`@supabase/ssr` 0.12) — `project.config.json`.

## 1. Executive Summary

Auditoria **estática do código** (fluxo real dos dados no front) + testes unit locais + `npm audit`.
**Não há ambiente de produção nem deploy**: headers reais servidos pela Vercel, Lighthouse, eventos reais
do Sentry, allowlist de Redirect URLs e CAPTCHA no projeto Supabase de produção **não foram possíveis de
validar** — marcados "re-checar no primeiro deploy". Nenhum login foi feito (o `.env.local` aponta para o
projeto de dev real do usuário) e nenhum e2e dependente de Supabase foi rodado.

Resultado: nenhum CRITICAL/HIGH. 1 MEDIUM **corrigido com teste** (open redirect pelo `next` de
`/nickname`), 4 LOW pendentes de decisão do usuário, 7 informativos.

SECURITY STATUS: **NO CRITICAL-HIGH ISSUES FOUND** (dentro do escopo e dos testes realizados).

## 2. Scope

- `src/` inteiro (App Router, `proxy.ts`, `lib/*`, `features/*`), `instrumentation*.ts`, `sentry.server.config.ts`,
  `next.config.ts`, `src/app/sw.ts`, `e2e/`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.env*`, `package.json`/lock.
- Fora do escopo: back (`go-bingo-back`, auditado à parte), configuração dos projetos Supabase/Sentry/Vercel.
- Semgrep não está instalado no projeto — não rodado.

## 3. Architecture

Next.js 16 (App Router). Páginas são quase todas client components que falam direto com a API Nest
(`apiFetch`, `Authorization: Bearer <access_token>`) e com o Socket.IO `/game` (token no pacote CONNECT).
Sessão do Supabase em cookies via `@supabase/ssr` (PKCE). `src/proxy.ts` renova a sessão e manda quem não
tem sessão para `/login?next=...` (gate de UX — a autorização real é da API). Login Google (OAuth PKCE →
`/auth/callback`) ou convidado anônimo com Turnstile. PWA via Serwist (cache só de estático). Sentry opcional
por DSN (M5). CSP e headers de segurança só no build de produção (M5).

## 4. Attack Surface

| Superfície | Tipo | Auth | Entrada | Observação |
|---|---|---|---|---|
| `/login?next=` | página (server) | pública | `next` → `safeNextPath` | passa `next` ao OAuth e ao convidado |
| `/auth/callback?code=&next=&error*=` | route handler | pública | `code` (PKCE), `next` | `exchangeCodeForSession`; redirect `${origin}${safeNext}` |
| `/auth/error?code=` | página | pública | `code` | só chaves de um mapa fixo; texto |
| `/nickname?next=` | página (server) + form | sessão | `next`, apelido | **M1** (corrigido) |
| `/`, `/create`, `/ranking`, `/[code]` | páginas | sessão (proxy) + JWT na API | código da sala, nome, maxPlayers | dados só via API |
| `/serwist/sw.js`, `/pwa-icons/[file]`, `/manifest.webmanifest`, `/~offline` | rotas estáticas | pública | `file` (lista fixa) | |
| Socket.IO `/game` (cliente) | WS | `auth.token` | eventos tipados (`contracts/events.ts`) | só `websocket` |
| Sentry (DSN público) | integração | — | eventos | `dataCollection` desligado |
| Cloudflare Turnstile, jsdelivr (fontes troika) | terceiros | — | — | na CSP |

## 5. Security Score (qualitativo)

| Área | Nota | Nota curta |
|---|---|---|
| Authentication | Bom | Supabase PKCE; callback valida `next`; Turnstile no convidado (enforcement no Supabase) |
| Authorization | Bom | front não decide nada; API checa tudo (ver auditoria do back) |
| Input Validation | Bom | mesmos schemas Zod do back (`src/contracts`) |
| API Security | N/A | API no back |
| Database Security | N/A | sem acesso a dados além do Supabase Auth |
| Infrastructure | Não avaliável | sem deploy; CI sem `permissions` (L4) |
| Dependencies | Atenção | 7 HIGH em `--omit=dev`, todos na cadeia do CLI `shadcn` (L3) |
| Secrets | Bom | só `NEXT_PUBLIC_*`; `.env*` ignorado |
| Logging | Bom | sem `console.*` em `src/`; Sentry sem PII |
| Business Logic | Bom | bots só cosméticos e desligados em produção |
| Frontend Security | Bom após correção | M1 corrigido; CSP com `'unsafe-inline'` (L1) |

## 6. Critical Findings

Nenhum.

## 7. High Findings

Nenhum.

## 8. Medium Findings

### M1 — Open redirect pelo `next` de `/nickname` — **CORRIGIDO** (`6fc9bf2`)

```text
Vulnerabilidade: Open redirect (next normalizado para URL protocol-relative)
Severidade: MEDIUM
Arquivo: src/lib/safe-next.ts (consumidor: src/features/auth/nickname-form.tsx:25)
Linha: 5-12 (antes da correção)
Componente/Endpoint: /nickname?next=…  (também /login, /auth/callback, que usam a mesma função)
Evidência: CONFIRMADO — safeNextPath('/.//evil.com') devolvia '//evil.com' (5 casos novos em
  safe-next.test.ts falhavam); NicknameForm faz router.replace(next) e o app router do Next
  (app-router-instance.js: isExternalURL → navegação MPA) sai para https://evil.com.
Como pode ser explorada: link https://<app>/nickname?next=/.//evil.com (ou /login?next=%2Fnickname%3Fnext%3D%2F.%2F%2Fevil.com
  para quem não tem sessão). Depois de escolher o apelido, a vítima cai no site do atacante (phishing
  "entre de novo com Google").
Impacto: phishing a partir do domínio legítimo; sem roubo direto de sessão.
  /auth/callback não era explorável (prefixa `${origin}`); /login idem (o next é re-sanitizado no callback).
Correção recomendada: rejeitar pathname normalizado que comece com "//". APLICADA.
Como validar a correção: npx vitest run src/lib/safe-next.test.ts (casos '/.//evil.com', '/..//evil.com',
  '/a/..//evil.com', '/./\\evil.com', '/%2E//evil.com' → '/').
```

## 9. Low Findings

### L1 — CSP com `'unsafe-inline'` em `script-src` (e `style-src`) — PENDENTE

```text
Severidade: LOW (hardening — nenhum sink de XSS encontrado)
Arquivo: src/lib/security-headers.ts:31-32
Evidência: CONFIRMADO pelo código (decisão do plano do M5)
Impacto: se surgir um XSS, a CSP não o bloqueia; os cookies do Supabase são legíveis por JS (I1),
  então XSS = sequestro de sessão.
Viabilidade de nonce: a doc do Next exige renderização dinâmica para nonce (o proxy gera o nonce e o
  Next injeta durante o SSR; página estática não recebe nonce). Hoje `/`, `/create`, `/ranking` são
  estáticas e `scripts/check-bundle.mjs` lê o HTML gerado delas. O proxy já roda em toda rota, então
  gerar o nonce lá é simples, mas obriga `await connection()`/dinâmico em todas as páginas, `'strict-dynamic'`
  e revalidar Turnstile, Sentry e os workers blob do troika. Não é trivial → não implementado.
Correção recomendada: manter no beta; na sequência migrar para nonce + 'strict-dynamic' (e adaptar o
  check:bundle), medindo TTFB. Decisão do usuário.
Como validar: e2e com trackCspViolations (e2e/support/csp.ts) sem violações + header sem 'unsafe-inline'.
```

### L2 — `https://cdn.jsdelivr.net` em `connect-src`/`font-src` — PENDENTE

```text
Severidade: LOW
Arquivo: src/lib/security-headers.ts:26-27,34
Evidência: CONFIRMADO pelo código — o troika (drei <Text>) baixa dados do unicode-font-resolver e fontes do jsdelivr em runtime.
Impacto: dependência de terceiro em runtime (conteúdo sem SRI; disponibilidade); amplia o canal de saída
  permitido pela CSP para um CDN público (relevante só pós-XSS).
Correção recomendada: servir a fonte do <Text> localmente (prop `font` com arquivo em /public) e desligar
  o resolver de fallback, removendo o jsdelivr da CSP. Decisão do usuário.
```

### L3 — `npm audit --omit=dev`: 7 HIGH na cadeia do CLI `shadcn` — PENDENTE

```text
Severidade: LOW (não alcançável em runtime)
Arquivo: package.json:36 ("shadcn" em dependencies), package-lock.json
Evidência: CONFIRMADO (npm audit) — braces@3.0.3 (GHSA-vfj7-8cjw-p6xm, DoS por padrão aninhado) via
  shadcn → fast-glob → micromatch; também @shadcn/registry, ts-morph. Exploração NÃO REPRODUZIDA: o app só
  usa `@import "shadcn/tailwind.css"` (globals.css:3) no build; nenhum glob com entrada de usuário.
  (npm audit completo: 9 HIGH, +eslint-config-next, dev.)
Correção recomendada: não usar `audit fix --force` (downgrade p/ shadcn 1.0.0). Mover `shadcn` para
  devDependencies (o CSS é resolvido no build) e atualizar quando houver patch. Decisão do usuário.
Como validar: npm audit --omit=dev sem HIGH.
```

### L4 — Workflow de CI sem `permissions:` e actions por tag — PENDENTE

```text
Severidade: LOW (hardening)
Arquivo: .github/workflows/ci.yml
Evidência: CONFIRMADO pelo código — GITHUB_TOKEN com permissão padrão do repositório; actions/checkout@v4 etc. por tag;
  job e2e usa secrets (BACK_REPO_TOKEN, E2E_SUPABASE_*) — não expostos a PR de fork.
Correção recomendada: `permissions: { contents: read }` no topo; opcionalmente pin por SHA. Decisão do usuário.
```

## 10. Informational

- **I1 — Cookies de sessão do Supabase legíveis por JS**: design do `@supabase/ssr` (o browser client precisa
  ler o token). Mitigação = ausência de XSS + CSP (L1).
- **I2 — Matcher do proxy pula caminhos terminados em `.png/.svg/...`** (`src/proxy.ts:9`): FALSE POSITIVE como
  vulnerabilidade — o proxy é gate de UX; dados só saem da API com JWT válido.
- **I3 — `NEXT_PUBLIC_ENABLE_BOTS`**: bots são só cosméticos (`scene3d/bots.ts`, nunca vão à store/servidor);
  ligados só fora de produção ou com a env = `1`, que não está no `.env.example` nem no CI. Re-checar que não
  existe nas envs de produção da Vercel no primeiro deploy.
- **I4 — Sentry**: `dataCollection` com `userInfo`, `cookies`, `httpHeaders`, `urlQueryParams` (remove `?code=`
  do OAuth e `?next=`), `databaseQueryData`, `stackFrameVariables` desligados e `httpBodies: []` no cliente e no
  servidor (`@sentry/nextjs` 11.4.0 — tipos conferidos em `@sentry/core`). `session-summary` só leva números e o
  motivo do fallback. Sem Replay. Re-checar no primeiro deploy: 3 eventos reais e "Prevent storing IP" no projeto.
- **I5 — Token do socket**: enviado no pacote CONNECT (função `auth`, relida a cada reconexão), só transporte
  `websocket`, nunca em URL. Socket aberto continua após o `exp` (achado L1 do back).
- **I6 — Turnstile**: o front só obtém o token; o bloqueio de convidado sem CAPTCHA depende do CAPTCHA ligado no
  Supabase Auth de produção — re-checar no primeiro deploy.
- **I7 — Callback OAuth**: `origin` vem de `request.url` e a allowlist de Redirect URLs do Supabase precisa ser
  exata (sem curingas amplos) — re-checar no primeiro deploy.

## 11. OWASP API Security Top 10

| Categoria | Status | Evidência | Risco |
|---|---|---|---|
| API1 BOLA | N/A (front) | identidade só do token na API | — |
| API2 Broken Authentication | PASS | PKCE via `@supabase/ssr`; `getClaims` no proxy; callback testado (`route.test.ts`) | I6, I7 |
| API3 BOPLA | N/A | — | — |
| API4 Resource Consumption | N/A | limites no back | — |
| API5 Function Level Authz | PASS | botões de host são só UI; servidor checa (`e2e/access-rules.spec.ts` + back) | — |
| API6 Sensitive Business Flows | PASS | convidado exige Turnstile | I6 |
| API7 SSRF | N/A | sem fetch server-side com URL do cliente | — |
| API8 Security Misconfiguration | PARTIAL | CSP/HSTS/nosniff/Referrer/Permissions-Policy; `'unsafe-inline'` | L1, L2 |
| API9 Improper Inventory | PASS | 2 route handlers + rotas estáticas (tabela §4) | — |
| API10 Unsafe Consumption of APIs | PASS | respostas da API validadas com Zod (`apiFetch` + schema) | — |

## 12. OWASP ASVS

| Área | Status | Observação |
|---|---|---|
| V1 Architecture | OK | front sem regra de segurança própria |
| V2 Authentication | OK | Supabase Auth; I6/I7 dependem de config de produção |
| V3 Session Management | OK | cookies `@supabase/ssr`; refresh no proxy com `Cache-Control: private, no-store` |
| V4 Access Control | OK | só UX; API decide |
| V5 Validation, Encoding | OK após M1 | React escapa; `dangerouslySetInnerHTML`/`innerHTML` = 0 |
| V6 Stored Cryptography | N/A | |
| V7 Error Handling and Logging | OK | `global-error` genérico; sem `console.*`; Sentry sem PII |
| V8 Data Protection | OK | SW não cacheia API/HTML/RSC |
| V9 Communication | Não avaliável | HSTS configurado; TLS só no deploy |
| V10 Malicious Code | OK | sem eval/`new Function` no código do app |
| V11 Business Logic | OK | bots só cosméticos |
| V12 Files and Resources | N/A | `pwa-icons/[file]` de lista fixa |
| V13 API and Web Service | N/A | |
| V14 Configuration | Parcial | env pública validada por Zod; L1–L4 |

## 13. Input Validation Matrix

| Campo | Onde | Tipo | Min | Max | Caracteres | Validação backend | Validação frontend | Status |
|---|---|---|---|---|---|---|---|---|
| `next` | `/login`, `/nickname`, `/auth/callback` | path | — | — | caminho interno | — | `safeNextPath` | OK após M1 |
| `code` (OAuth) | `/auth/callback` | string | — | — | — | Supabase (PKCE verifier no cookie) | — | OK |
| `code` (erro) | `/auth/error` | string | — | — | — | — | mapa fixo | OK |
| apelido | `/nickname` → `PATCH /me` | string | 3 | 16 | `[A-Za-z0-9_À-ú ]` + blocklist | `nicknameSchema` | mesmo schema + `maxLength` | OK |
| nome da sala | `/create` → `POST /rooms` | string | 3 | 24 | livre (texto) | `createRoomSchema` | mesmo schema | OK (render como texto) |
| maxPlayers | `/create` | literal | 10/15/25 | — | — | Zod | `<select>` + Zod | OK |
| código da sala | `/[code]`, entrar por código | string | 6 | 6 | alfabeto sem 0/O/1/I | `roomCodeSchema` | `roomCodeSchema` | OK |
| `?bots=` | sala | int | 0 | MAX_SLOTS | — | — (não vai ao servidor) | `parseBots` | OK |

## 14-25. Auditorias específicas

- **Authentication**: `/auth/callback` troca o `code` por sessão (PKCE do `@supabase/ssr`), erros do provedor vão
  para `/auth/error` com o código URL-encoded; `next` sanitizado. Convidado: `signInAnonymously({ captchaToken })`.
  Upgrade: `linkIdentity` com `redirectTo` no próprio origin.
- **Authorization**: `src/proxy.ts` + `lib/supabase/proxy.ts` usam `getClaims()` (verifica a assinatura) e mandam
  quem não tem sessão para `/login`; `/login` e `/auth/*` públicos. Nenhuma decisão de permissão fica só no front.
- **SQL Injection**: N/A (o front não acessa banco; `e2e/support/db.ts` usa query parametrizada e só no banco de teste).
- **XSS**: `grep dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document.write|eval(` em `src`/`e2e` = 0.
  Apelido/nome da sala renderizados como texto JSX (`members-list.tsx:18`, `lobby-view.tsx:23`, `public-rooms.tsx:15`,
  `ranking-list.tsx:48`, `result-dialog.tsx:15`), `fillText` no telão (`telao.ts:87,93`) e `<Text>` do drei
  (`name-labels.tsx:25`). Link "Abrir no Chrome" (`in-app-browser.ts:10`) monta `intent://` com host/path/search do
  próprio `location`; o `#` não pode vir na query, então não há injeção de extras do Intent.
- **CSRF**: API usa header `Authorization`; cookies do Supabase são `SameSite=Lax`; o único GET com efeito é o
  callback OAuth (protegido pelo verifier PKCE).
- **IDOR/BOLA**: N/A no front.
- **SSRF**: N/A.
- **File Upload**: N/A.
- **Secrets**: `git grep -nE "sb_secret|service_role|SERVICE_ROLE|eyJhbGci"` → só o plano e
  `templates/supabase/.env.example` (vazio); `git log -S sb_secret --all` → só o commit do plano (`b3a58d2`).
  `git ls-files | grep -i env` → `.env.example`, templates, `e2e/support/env.ts`, `src/lib/env*.ts`; `.env.local`
  ignorado e só com `NEXT_PUBLIC_*`. e2e sem segredo (Turnstile de teste `1x00…AA`, Postgres `bingo:bingo` local;
  Supabase de e2e via secrets do GitHub).
- **Dependency**: L3.
- **Infrastructure**: sem deploy; CI em L4.
- **Business Logic**: `?bots=N` só gera membros falsos na cena 3D, desligado em produção (I3).

## 26. Security Headers

Só no build de produção (`next.config.ts:9-11`; em dev o HMR precisa de eval). `buildCsp` (`security-headers.ts`):
`default-src 'self'`; `script-src 'self' 'unsafe-inline' challenges.cloudflare.com` (L1); `connect-src` com API
(https+wss), Supabase (https+wss), Turnstile, jsdelivr (L2) e host do Sentry; `frame-src` só Turnstile;
`worker-src 'self' blob:`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`.
Mais HSTS 2 anos + includeSubDomains, `nosniff`, `Referrer-Policy strict-origin-when-cross-origin`,
`Permissions-Policy` (câmera, microfone, geolocalização, pagamento desligados). Testes: `security-headers.test.ts`.
Verificação contra o deploy (curl -I / Lighthouse): **re-checar no primeiro deploy**.

## 27. Rate Limiting

No back. O front só adiciona o Turnstile no convidado (I6).

## 28. Logging & Monitoring

- Nenhum `console.*` em `src/` fora de testes.
- Sentry: `global-error.tsx` (exceções do render), `onRequestError` no servidor, `captureRouterTransitionStart`,
  `session-summary` (telemetria numérica). `tracesSampleRate: 0.1`; `tracePropagationTargets` padrão (só mesmo
  origin), então nenhum header `sentry-trace`/`baggage` vai para a API. PII desligada (I4).

## 29. Recommendations

- **Imediato (antes do beta)**: nada bloqueante. Configurar na Vercel só as `NEXT_PUBLIC_*` necessárias (sem
  `NEXT_PUBLIC_ENABLE_BOTS`); ligar CAPTCHA no Supabase de produção; allowlist exata de Redirect URLs.
- **Curto prazo**: L3 (mover `shadcn` para devDependencies), L4 (`permissions: contents: read`), L2 (fonte local).
- **Médio prazo**: L1 (CSP com nonce + `'strict-dynamic'`).
- **Primeiro deploy**: `curl -I` nos headers, Lighthouse, 3 eventos reais no Sentry, "Prevent storing IP".

## Conclusão

SECURITY STATUS: **NO CRITICAL-HIGH ISSUES FOUND**

Top problemas (prioridade):

1. M1 — open redirect via `next` em `/nickname` — `src/lib/safe-next.ts` — **corrigido** (`6fc9bf2`).
2. L1 — CSP com `'unsafe-inline'` — `security-headers.ts:31` — nonce + `'strict-dynamic'` — Média.
3. L3 — HIGH do `npm audit` no CLI `shadcn` — `package.json:36` — mover para devDependencies — Média.
4. L2 — jsdelivr em runtime/CSP — `security-headers.ts:26` — fonte local — Baixa.
5. L4 — CI sem `permissions` — `ci.yml` — `contents: read` — Baixa.
6. I6/I7 — CAPTCHA e Redirect URLs no Supabase de produção — configuração — Alta no deploy.

Recomendação: **sim, pode seguir para o beta fechado** do ponto de vista do front, desde que o usuário decida
L1–L4 e que as checagens de produção (headers servidos, Sentry, CAPTCHA, Redirect URLs, envs da Vercel) sejam
feitas no primeiro deploy — elas não foram validadas aqui.
