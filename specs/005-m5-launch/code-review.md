# Code Review: M5 — Polimento e lançamento (front)

- **Spec**: `docs/PRD.md` §6.1/§3.4 | **Plan**: `docs/superpowers/plans/2026-10-08-m5-launch.md` (Tasks do front: e2e, Sentry/telemetria, CSP/headers) | **Security Review**: `specs/005-m5-launch/security-review.md` (Gate: PASS WITH WARNINGS)
- **Status**: Mudanças solicitadas — nenhum achado bloqueante no código; falta a decisão do usuário sobre os itens pendentes da Security Review (ver Conclusão).

Escopo revisado: `git diff b3a58d2..9588c9e` (Playwright e2e + CI, Sentry, telemetria de sessão, CSP/headers) mais a
correção desta fase (`6fc9bf2`). Skill: `.claude/skills/code-review/SKILL.md`.

## Achados

| Arquivo:Linha | Severidade | Problema | Correção sugerida |
|---|---|---|---|
| `src/lib/safe-next.ts:10` | média | `"/.//evil.com"` normalizava para `"//evil.com"` e o `NicknameForm` navegava para fora do site (M1 da Security Review). | **Corrigido** em `6fc9bf2` (rejeita pathname que comece com `//`), com 5 casos de teste que falhavam antes. |
| `src/lib/telemetry.ts:59` / `src/features/game/room-screen.tsx:45-52` | média | Cada visita a uma sala com algo medido vira um `captureMessage` no Sentry. Isso consome a mesma cota de eventos dos erros; com o beta crescendo, a cota pode acabar e erros reais passam a ser descartados. | Amostrar o resumo (ex.: enviar só 10–20% das sessões, `Math.random() < RATE` em `reportSessionSummary`) ou usar a API de métricas do Sentry; manter erros sem amostragem. |
| `src/features/game/use-game-connection.ts:55-58` | baixa | A latência do sorteio é `Date.now() − drawnAt`, então inclui a diferença entre o relógio do aparelho e o do servidor (está documentado); `addDrawLatencyMs` descarta valores negativos, o que puxa o p95 para cima em aparelhos adiantados. | Aceitável para tendência; se o número virar SLO, medir o offset do relógio no `room:join` (horário do servidor no snapshot) e descontar. |
| `src/app/auth/error/page.tsx:15` | baixa | `MESSAGES[code]` com `?code=constructor` (ou `toString`) devolve uma função do protótipo, e o `<p>` fica vazio em vez da mensagem padrão. Não é segurança: não reflete texto. É anterior ao M5. | `Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : PADRÃO`. |
| `e2e/game-flow.spec.ts:28,49` | baixa | Violações de CSP só são checadas na página do host do teste de partida completa; o palco 3D do convidado e o fluxo de login/Turnstile não são vigiados. | Chamar `trackCspViolations` também em `newGuest` (`e2e/support/players.ts`) e checar no fim de cada teste. |
| `next.config.ts:16-17` | baixa | `process.env.NEXT_PUBLIC_API_URL!` e `process.env.NEXT_PUBLIC_SUPABASE_URL!`: se faltarem no build de produção, `new URL(undefined)` falha com `TypeError: Invalid URL` sem dizer qual variável falta (o `env.ts` diz, mas roda depois). | Opcional: reutilizar `parsePublicEnv(process.env)` no `next.config.ts` para a mensagem ficar clara. |

Pontos verificados sem achado:

- **Correção**: CSP montada a partir das envs (API https+wss, Supabase https+wss, host do DSN) e só em produção,
  com teste (`security-headers.test.ts`); Sentry com DSN opcional, `dataCollection` desligado no cliente e no
  servidor, `global-error.tsx` genérico; o resumo de sessão sai uma vez (unmount ou `pagehide`) e não sai se nada
  foi medido (`room-screen.test.tsx`); latência só de números ao vivo, não dos repassados após o join
  (`use-game-connection.test.ts`). e2e cobrem partida completa, reload, 2D e regras de host; o job de CI sobe o
  back e um Postgres efêmero.
- **Simplicidade/YAGNI**: telemetria é uma função pura com closures (`createSessionTelemetry`) e limites de amostra
  (5000 frames, 200 sorteios); sem lib nova além de `@sentry/nextjs`.
- **Consistência com o preset**: nada de Prisma no front; Supabase só para Auth; `pg` só em devDependencies, para o e2e.
- **Performance**: `FpsProbe` só empilha um número por frame (com teto); `check:bundle` garante que `/`, `/create` e
  `/ranking` continuam sem three.js.

## Confirmação de itens da Security Review

- [ ] Todo item "Pendente" de `security-review.md` foi resolvido ou explicitamente aceito como risco.
  **Não**: L1 (CSP `'unsafe-inline'`), L2 (jsdelivr), L3 (`npm audit`, CLI shadcn) e L4 (CI sem `permissions`)
  aguardam decisão do usuário. Este agente não aceitou nenhum risco.

## Confirmação de escopo

- [x] A implementação cobre os requisitos do front do M5 no plano (e2e críticos, Sentry, telemetria, CSP/headers).
- [x] Nenhuma funcionalidade fora do escopo foi adicionada (a correção desta fase é de segurança, com teste).
- [x] Testes existem e passam: `npm run lint`, `npm run typecheck`, `npm run test:cov` (70 arquivos, 344 testes,
  cobertura de linhas 98.73%), `npm run build` e `npm run check:bundle`, todos verdes depois de `6fc9bf2`.
  `npm run e2e` **não foi rodado** nesta fase: precisa de um Supabase e o `.env.local` aponta para o projeto de dev real do usuário.

## Conclusão

**Mudanças solicitadas**, só pela regra do `/review`: não dá para declarar "Aprovado" com itens pendentes na
Security Review. Para aprovar, falta:

1. Usuário decidir L1–L4: corrigir ou registrar em "Riscos aceitos explicitamente", com aprovação.
2. Rodar `npm run e2e` contra um ambiente de teste (CI com os secrets `E2E_*`).

As sugestões média/baixa acima (amostrar a telemetria, `Object.hasOwn` no `/auth/error`, CSP vigiada em mais
testes) não bloqueiam. A amostragem da telemetria é recomendada antes de abrir o beta.
