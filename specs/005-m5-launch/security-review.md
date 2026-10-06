# Security Review: M5 — Polimento e lançamento (front)

- **Plan relacionado**: `docs/superpowers/plans/2026-10-08-m5-launch.md` (spec = `docs/PRD.md` §6.1/§3.4; não há `spec.md`/`plan.md` SpecKit para o M5)
- **Status**: Aprovado com ressalvas (itens em "Pendente — decisão do usuário")
- **Auditoria completa relacionada**: `security-audits/2026-10-06-full-audit.md`

Obrigatoriedade (SECURITY.md): sim — integração externa nova (Sentry, que pode receber dado de usuário),
mudança de configuração de segurança (CSP/headers) e superfície de autenticação reavaliada.

Limite desta revisão: **não existe deploy nem projeto de produção**. Headers foram validados por unit test
e pelo build de produção local; nenhum `curl -I`/Lighthouse contra um deploy, nenhum evento real do Sentry,
nenhum login (o `.env.local` aponta para o projeto de dev real) e nenhum e2e dependente de Supabase.

## Escopo da alteração

- Feature/correção: `git diff b3a58d2..9588c9e` — Playwright e2e + job de CI (`0e3a084`, `5014b37`, `46f83d2`),
  telemetria de sessão e Sentry (`a7c25a3`, `b541692`, `8cdd54f`), CSP e headers de segurança (`9588c9e`).
- Arquivos: `next.config.ts`, `src/lib/security-headers.ts`, `instrumentation.ts`, `instrumentation-client.ts`,
  `sentry.server.config.ts`, `src/app/global-error.tsx`, `src/lib/telemetry.ts`, `src/lib/env.ts`,
  `src/features/game/{room-screen,use-game-connection,use-scene-mode}.ts(x)`, `scene3d/{fps-probe,game-stage}.tsx`,
  `e2e/**`, `playwright.config.ts`, `.github/workflows/ci.yml`, deps `@sentry/nextjs`, `@playwright/test`, `pg` (dev).
- Superfície existente reavaliada junto (pedido do controlador): callback OAuth e `next` (`safe-next.ts`,
  `auth/callback/route.ts`), cookies (`lib/supabase/*`), `proxy.ts`, cache do service worker
  (`lib/pwa/cache-rules.ts`, `app/sw.ts`), `NEXT_PUBLIC_ENABLE_BOTS`, Turnstile, token do socket
  (`lib/socket.ts`, `lib/session.ts`), renderização de apelido/nome da sala, segredos e `.env*`.
- Blast radius:
  - `next.config.ts` `headers()` vale para **toda rota** (inclusive `/serwist/sw.js`); só em `NODE_ENV=production`.
  - `withSentryConfig` envolve o build inteiro; sem `SENTRY_AUTH_TOKEN` não sobe source map (build verde sem token).
  - `useGameConnection(code, onDrawLatency)` e `useSceneMode(onContextLoss)` ganharam callback opcional — único
    consumidor é `RoomScreen`; testes antigos continuam verdes.
  - `safeNextPath` (corrigido nesta fase) é usado por `/login`, `/apelido` e `/auth/callback` — os três reavaliados.

## "Não confie no frontend"

O front não aplica nenhuma regra de segurança própria: botões de host, bots e o gate do `proxy.ts` são UX;
toda permissão é decidida pela API/socket com o JWT (ver `go-bingo-back/specs/005-m5-launch/security-review.md`).
O que é responsabilidade do front e foi checado aqui: não redirecionar para fora do site, não renderizar texto
de outros usuários como HTML, não cachear resposta autenticada, não vazar token/PII para logs/Sentry.

## Achados

```text
Vulnerabilidade: Open redirect — next normalizado para URL protocol-relative ("/.//evil.com" → "//evil.com")
Severidade: MEDIUM
Arquivo: src/lib/safe-next.ts (consumidor explorável: src/features/auth/nickname-form.tsx:25)
Linha: 5-12 (antes da correção)
Componente/Endpoint: /apelido?next=
Evidência: CONFIRMADO — 5 casos novos em src/lib/safe-next.test.ts falhavam (recebido "//evil.com"); o app
  router do Next 16.3.8 trata URL de outro origin como navegação MPA (app-router-instance.js, isExternalURL).
Como pode ser explorada: vítima abre https://<app>/apelido?next=/.//evil.com (ou via /login?next=... se ainda
  não tem sessão), escolhe o apelido e é levada para evil.com (phishing com tela falsa de login).
Impacto: phishing a partir do domínio legítimo. /auth/callback não era explorável (prefixa o origin).
Correção recomendada: rejeitar pathname normalizado que comece com "//". APLICADA — commit 6fc9bf2.
Como validar a correção: npx vitest run src/lib/safe-next.test.ts (19 casos verdes).
```

```text
Vulnerabilidade: CSP permite 'unsafe-inline' em script-src (e style-src)
Severidade: LOW (hardening; nenhum sink de XSS encontrado)
Arquivo: src/lib/security-headers.ts
Linha: 31-32
Componente/Endpoint: todas as páginas (build de produção)
Evidência: CONFIRMADO pelo código (exigência do plano do M5)
Como pode ser explorada: só em conjunto com um XSS futuro — a CSP não bloquearia o script injetado e os
  cookies do Supabase são legíveis por JS.
Impacto: CSP não serve de segunda barreira contra XSS.
Correção recomendada: nonce por requisição no proxy + 'strict-dynamic'. Viabilidade: a doc do Next exige
  renderização dinâmica para nonce (páginas estáticas não recebem nonce); hoje /, /criar e /ranking são estáticas
  e o check:bundle lê esse HTML. Exige connection()/dinâmico em todas as páginas, ajuste do check:bundle e
  revalidar Turnstile/Sentry/workers blob do troika — não trivial, não implementado. PENDENTE — decisão do usuário.
Como validar a correção: header sem 'unsafe-inline' + e2e com trackCspViolations sem violações.
```

```text
Vulnerabilidade: Terceiro em runtime na CSP (https://cdn.jsdelivr.net em connect-src e font-src)
Severidade: LOW
Arquivo: src/lib/security-headers.ts
Linha: 26-27, 34
Componente/Endpoint: palco 3D (troika / drei <Text>)
Evidência: CONFIRMADO pelo código
Como pode ser explorada: CDN comprometido/indisponível afeta fontes do palco; após um XSS, é mais um destino
  permitido para fetch.
Impacto: baixo (integridade/disponibilidade das fontes; canal extra de saída pós-XSS).
Correção recomendada: fonte local no <Text> (prop `font`) e remover o jsdelivr da CSP. PENDENTE — decisão do usuário.
Como validar a correção: buildCsp sem jsdelivr + palco 3D sem violação de CSP no e2e.
```

```text
Vulnerabilidade: npm audit --omit=dev com 7 HIGH na cadeia do CLI shadcn (braces GHSA-vfj7-8cjw-p6xm)
Severidade: LOW (não alcançável em runtime)
Arquivo: package.json:36, package-lock.json
Componente/Endpoint: shadcn@4.21.3 → fast-glob → micromatch → braces@3.0.3; @shadcn/registry; ts-morph
Evidência: CONFIRMADO (npm audit); exploração NÃO REPRODUZIDA — o app só importa shadcn/tailwind.css no build.
Correção recomendada: não usar audit fix --force (downgrade para shadcn 1.0.0); mover shadcn para
  devDependencies e atualizar quando houver patch. PENDENTE — decisão do usuário.
Como validar a correção: npm audit --omit=dev sem HIGH.
```

```text
Vulnerabilidade: Workflow de CI sem bloco permissions e actions fixadas por tag
Severidade: LOW (hardening)
Arquivo: .github/workflows/ci.yml
Linha: 1-3
Componente/Endpoint: GitHub Actions (job e2e usa BACK_REPO_TOKEN e E2E_SUPABASE_*)
Evidência: CONFIRMADO pelo código
Correção recomendada: `permissions: { contents: read }`; opcional pin por SHA. PENDENTE — decisão do usuário.
Como validar a correção: CI verde com o token restrito.
```

Informativos (sem ação obrigatória; detalhes em `security-audits/2026-10-06-full-audit.md` §10):
I1 cookies do Supabase legíveis por JS (design do `@supabase/ssr`); I2 matcher do proxy pula caminhos com extensão de
imagem (FALSE POSITIVE — gate só de UX); I3 `NEXT_PUBLIC_ENABLE_BOTS` só cosmético e ausente do CI/`.env.example`;
I4 Sentry sem PII por configuração (eventos reais não inspecionados); I5 token do socket no pacote CONNECT, só
websocket; I6 Turnstile depende do CAPTCHA no Supabase de produção; I7 allowlist de Redirect URLs do Supabase.

## Checklist por tópico

### Autenticação e Autorização (`references/auth-authz.md`)

- [x] OAuth PKCE e troca do `code` no servidor — Resolvido — `auth/callback/route.ts`; `route.test.ts`
- [x] `next` só interno — Resolvido — M1 corrigido (`6fc9bf2`); `/login`, `/apelido`, `/auth/callback` usam `safeNextPath`
- [x] Sessão verificada no proxy com `getClaims()` (assinatura) — Resolvido — `lib/supabase/proxy.ts`; `proxy.test.ts`
- [x] Matcher do proxy cobre as páginas e exclui só estático/PWA — Resolvido — `proxy.test.ts` (I2 informativo)
- [x] Nenhuma permissão decidida só no front — Resolvido — host/kick/start no servidor; `e2e/access-rules.spec.ts`
- [x] Token do socket fora da URL e renovado a cada reconexão — Resolvido — `lib/socket.ts` (`auth` como função)
- [ ] Turnstile aplicado de fato — Não foi possível validar — depende do CAPTCHA no Supabase de produção (I6)
- [ ] Redirect URLs exatas no Supabase — Não foi possível validar — configuração de produção (I7)

### Injection (`references/injection.md`)

- [x] XSS: `dangerouslySetInnerHTML`/`innerHTML`/`document.write`/`eval` = 0 em `src` e `e2e` — Resolvido
- [x] Apelido/nome da sala só como texto (JSX, `fillText`, `<Text>` do drei) — Resolvido — ver auditoria §14-25
- [x] `/auth/erro` não reflete o `code` — Resolvido — só mensagens de um mapa fixo
- [x] CSRF — Não aplicável — API por header; callback protegido pelo verifier PKCE
- [x] SQL — Não aplicável no app; `e2e/support/db.ts` parametrizado e só no banco de teste
- [x] SSRF / Path traversal / Command injection — Não aplicável (`pwa-icons/[file]` só de lista fixa)

### API / Headers (`references/api-security.md`)

- [x] CSP: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` — Resolvido — `security-headers.test.ts`
- [ ] CSP sem `'unsafe-inline'` — Pendente — L1
- [ ] CSP sem terceiro em runtime além do necessário — Pendente — L2
- [x] HSTS, nosniff, Referrer-Policy, Permissions-Policy — Resolvido — `security-headers.ts:52-58`
- [ ] Headers servidos pelo deploy (curl -I / Lighthouse) — Não foi possível validar — re-checar no primeiro deploy
- [x] Rate limit / CORS — Não aplicável no front (back)

### Secrets, Dados, Logs, Dependências, Config (`references/data-secrets-logging.md`)

- [x] Sem segredo versionado — Resolvido — `git grep sb_secret|service_role` e `git log -S sb_secret --all` só acham o plano e um template vazio
- [x] `.env*` fora do git — Resolvido — `git ls-files | grep -i env`: `.env.example`, templates, `e2e/support/env.ts`, `src/lib/env*.ts`
- [x] Só `NEXT_PUBLIC_*` no bundle — Resolvido — `.env.local`/`.env.example` só têm `NEXT_PUBLIC_*`; `env.ts` valida com Zod
- [x] e2e sem segredo real — Resolvido — Turnstile de teste, Postgres local, Supabase via secrets do GitHub
- [x] Sentry sem token/e-mail/apelido — Resolvido no código — `dataCollection` desligado (cliente e servidor), `httpBodies: []`, `urlQueryParams: false`; telemetria só numérica (`telemetry.test.ts`). Eventos reais: re-checar no primeiro deploy
- [x] Sem `console.*` em `src/` — Resolvido
- [x] Service worker não cacheia API/HTML/RSC — Resolvido — `cache-rules.ts` (só `/_next/static/` e `/pwa-icons/` do próprio origin) + navegação `NetworkOnly`; `cache-rules.test.ts`
- [x] Refresh de sessão com `Cache-Control: private, no-store` — Resolvido — `lib/supabase/proxy.ts`; `proxy.test.ts`
- [x] `NEXT_PUBLIC_ENABLE_BOTS` nunca em produção — Resolvido no repo (I3); re-checar envs da Vercel no deploy
- [ ] Dependências sem HIGH — Pendente — L3 (CLI shadcn, não alcançável em runtime)
- [ ] CI com menor privilégio — Pendente — L4

### Upload de Arquivos

Não aplicável.

### RLS

Não aplicável ao front (sem acesso a tabelas; RLS validada no back).

## Pendente — decisão do usuário

Nenhum destes foi aceito como risco por este agente; cada um precisa de decisão explícita.

| Item | Severidade | Recomendação |
|---|---|---|
| L1 — CSP com `'unsafe-inline'` | LOW | Aceitável no beta fechado se o usuário aprovar; migrar para nonce + `'strict-dynamic'` (todas as páginas dinâmicas) no médio prazo. |
| L2 — jsdelivr na CSP (fontes do troika) | LOW | Corrigir no curto prazo servindo a fonte localmente. |
| L3 — 7 HIGH do `npm audit --omit=dev` (CLI shadcn) | LOW | Mover `shadcn` para devDependencies; nunca `audit fix --force`. |
| L4 — CI sem `permissions` | LOW | Adicionar `permissions: { contents: read }` (mudança de 2 linhas). |
| Checagens de produção (headers servidos, Lighthouse, eventos do Sentry, CAPTCHA, Redirect URLs, envs da Vercel) | — | Repetir no primeiro deploy; não validadas aqui. |

## Riscos aceitos explicitamente

Nenhum (aguardando decisão do usuário sobre a tabela acima).

## Security Gate

```text
Status: PASS WITH WARNINGS

CRITICAL: 0
HIGH: 0
MEDIUM: 1 (corrigido)
LOW: 4 (pendentes)
INFORMATIONAL: 7
```

Sem CRITICAL/HIGH → liberado para `/review`. Os avisos são L1–L4, todos em "Pendente — decisão do usuário",
mais as checagens que só um deploy permite.
