# Melhorias de UX (Pacotes A–E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partida sem frustração (A), espectador para quem chega atrasado (B), tela de perfil (C), emotes ao vivo (D) e narração das bolas (E).

**Architecture:** O back (NestJS + Socket.IO + Prisma) é a fonte da verdade e dono dos contratos (`go-bingo-back/src/contracts`, copiados para o front por `npm run contracts:sync`). Toda regra nova fica no back e é testada lá (unit com Prisma mockado + e2e com Postgres de teste). O front (Next.js 16 + Zustand + R3F) consome eventos pelo reducer puro `features/game/store.ts`; UI nova é DOM sobre o palco ("3D é palco, HUD é DOM"), com o 3D só desenhando.

**Tech Stack:** NestJS 11, Prisma 7, Socket.IO 4, Zod 4, Jest (back); Next.js 16, React 19, Zustand 5, R3F 9 + drei 10, Vitest + Testing Library (front).

**Spec:** `docs/superpowers/specs/2026-10-07-ux-melhorias-design.md` (Pacote F — avatar — fora deste plano por decisão do Gustavo).

## Global Constraints

- Contratos só se editam em `go-bingo-back/src/contracts/*`; depois `cd go-bingo-back && npm run contracts:sync` (sobrescreve `go-bingo-front/src/contracts`). Nunca editar `go-bingo-front/src/contracts` à mão.
- Cobertura mínima 80% (statements/branches/functions/lines) nos dois repos.
- Textos de UI em pt-BR. Commits em inglês, Conventional Commits, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Branches: back `feat/ux-improvements` (a partir de `main`); front `feat/ux-melhorias` (a partir de `docs/ux-melhorias`).
- Nada de HTML com texto de usuário dentro do canvas 3D (apelidos continuam `<Text>`); emojis no 3D são textura de canvas desenhada só a partir do enum fixo de emotes.
- Alvos de toque ≥ 44×44 px na HUD (exceção: botões-ícone 36 px já usados no topo do palco).

## Review Focus

1. **Espectador vira jogador na rodada seguinte** — depois de `game:won`/`game:ended` e "Jogar de novo", quem entrou assistindo recebe snapshot de lobby e pode gerar cartela (pinado no e2e do back da Task 3).
2. **Espectador não perde moedas nem vê "-20"** — o diálogo de resultado só mostra perda para quem tinha cartela (Task 4).
3. **Todos com cartela saem, só espectadores ficam** — a partida termina na hora com "Todos os jogadores saíram", sem esperar 75 bolas (Tasks 3 e 4).
4. **Emote em rajada / RATE_LIMITED** — erro de emote nunca vira toast; botões travam 1,5 s após enviar (Task 8).
5. **Narração com som mudo ou sem `speechSynthesis`** — mudo silencia tudo; sem suporte, o botão nem aparece (Task 9).

---

## File Structure

**Back (`go-bingo-back/`)**
- `src/contracts/events.ts` — + `EMOTES`, `emoteSchema`, `emotePayloadSchema`, `ROOM_EMOTE`/`EMOTED`, `gameEndedReasonSchema`.
- `src/contracts/profile.ts` — + `coinEntrySchema`, `profileStatsSchema`, `COIN_HISTORY_LIMIT`.
- `src/game/membership.service.ts` — `join` aceita sala `IN_GAME` (entra como espectador).
- `src/game/games.service.ts` — + `endIfNoPlayers(code)`.
- `src/game/game.gateway.ts` — encerra partida sem jogadores; handler `room:emote`.
- `src/profiles/profiles.service.ts` — + `stats(userId)`; `profiles.controller.ts` — `GET /me/stats`.
- `src/ranking/ranking.service.ts` — `position` pública; `ranking.module.ts` exporta o service; `profiles.module.ts` importa.
- `prisma/schema.prisma` + `prisma/migrations/20261010000000_game_winner_index/migration.sql` — índice `Game.winnerId`.

**Front (`go-bingo-front/src/`)**
- `features/game/store.ts` — canClaim pelo servidor, `selectMyRemaining`, `selectIsSpectator`, `endReason`, `reactions`.
- `features/game/remaining-panel.tsx` — badge do jogador.
- `features/game/card-grid.tsx` — `size="sm"` somente leitura.
- `features/game/lobby-view.tsx`, `result-dialog.tsx`, `game-view.tsx` — textos, cartela vencedora, espectador, emotes, narração.
- `features/game/emotes/` — `emote-picker.tsx`, `reaction-feed.tsx`, `labels.ts`.
- `features/game/scene3d/emote-bubbles.tsx` + `emote-bubble.ts` (regras puras).
- `features/game/sound/use-persisted-flag.ts`, `narration.ts`, `use-narration.ts`, `narration-toggle.tsx`.
- `features/profile/` — `use-profile-stats.ts`, `nickname-editor.tsx`, `stats-grid.tsx`, `coin-history.tsx`, `profile-view.tsx`.
- `features/auth/use-logout.ts`; `lib/nickname.ts` + `validateNickname`.
- `app/(app)/perfil/page.tsx`; `app/(app)/page.tsx` (chip → perfil); `features/nav/app-dock.tsx`.

---

### Task 1: BINGO! pelo servidor + "Faltam X" (Pacote A1/A2, front)

**Files:**
- Modify: `go-bingo-front/src/features/game/store.ts`
- Modify: `go-bingo-front/src/features/game/remaining-panel.tsx`
- Modify: `go-bingo-front/src/features/game/game-view.tsx` (passa `myUserId`)
- Test: `go-bingo-front/src/features/game/store.test.ts`, `remaining-panel.test.tsx` (novo), `game-view.test.tsx`

**Interfaces:**
- Produces: `selectMyRemaining(state: GameStoreState): number | null`; `RemainingPanel({ remaining, members, myUserId })`.

- [ ] **Step 1: testes que falham** — em `store.test.ts`:

```ts
describe('selectCanClaim (servidor manda)', () => {
  function game(remaining: number, marked: number[]) {
    const snap = { ...baseSnapshot(), status: 'IN_GAME' as const, myCard: { id: CARD, grid, marked }, game: { id: GAME, drawn: [1], drawIntervalMs: 5000, remaining: { [ME]: remaining } } };
    return reduce(initialGameState(ME), { event: 'room:state', payload: snap });
  }
  it('libera com 0 faltando mesmo sem nada marcado', () => expect(selectCanClaim(game(0, []))).toBe(true));
  it('libera pela marcação local completa (progress ainda não chegou)', () => expect(selectCanClaim(game(2, ALL_BUT_FREE))).toBe(true));
  it('bloqueia com 1 faltando e marcação incompleta', () => expect(selectCanClaim(game(1, [0]))).toBe(false));
  it('selectMyRemaining devolve o meu número ou null sem cartela', () => {
    expect(selectMyRemaining(game(3, []))).toBe(3);
    const s = game(3, []);
    expect(selectMyRemaining({ ...s, snapshot: { ...s.snapshot!, myCard: null } })).toBeNull();
  });
});
```

(`baseSnapshot`, `grid`, `CARD`, `GAME`, `ALL_BUT_FREE` = helpers do arquivo; criar os que faltarem no topo.)

`remaining-panel.test.tsx`:

```tsx
it('mostra quanto me falta no gatilho e destaca "você"', async () => {
  render(<RemainingPanel remaining={{ [ME]: 1, [ANA]: 3 }} members={members} myUserId={ME} />);
  const trigger = screen.getByRole('button', { name: /pedras que faltam.*você: por 1/i });
  expect(trigger).toHaveTextContent('Por 1!');
  await userEvent.click(trigger);
  expect(screen.getByText('Eu (você)')).toBeInTheDocument();
});
it('sem número meu (espectador) não mostra badge', () => {
  render(<RemainingPanel remaining={{ [ANA]: 3 }} members={members} myUserId={ME} />);
  expect(screen.getByRole('button', { name: 'Pedras que faltam' })).toBeInTheDocument();
});
```

Trocar o teste `keeps BINGO disabled until every cell is marked` em `game-view.test.tsx` para usar `remaining: { [ME]: 2 }` e adicionar `enables BINGO when the server says 0 left` (nada marcado, remaining 0 → botão habilitado).

- [ ] **Step 2:** `npx vitest run src/features/game` → FAIL.
- [ ] **Step 3: implementação**

```ts
export function selectMyRemaining(state: GameStoreState): number | null {
  const s = state.snapshot;
  if (!s?.game || !s.myCard || !state.myUserId) return null;
  return s.game.remaining[state.myUserId] ?? null;
}

export function selectCanClaim(state: GameStoreState): boolean {
  const s = state.snapshot;
  if (!s || s.status !== 'IN_GAME' || !s.myCard) return false;
  // O servidor valida pelos números sorteados, não pela marcação (PRD US-4.4).
  if (selectMyRemaining(state) === 0) return true;
  const marked = new Set(s.myCard.marked);
  if (s.winPattern === 'LINE') return closestLine((i) => marked.has(i)) === 0;
  marked.delete(FREE_INDEX);
  return marked.size === 24;
}
```

`remaining-panel.tsx`: `badge(left)` → `0: 'BINGO!'`, `1: 'Por 1!'`, senão `` `Faltam ${left}` ``; gatilho com `aria-label={mine == null ? 'Pedras que faltam' : `Pedras que faltam (você: ${badge(mine).toLowerCase()})`}`; texto visível "Pedras" + badge (âmbar quando ≤ 1); linha do jogador `"{nick} (você)"` com borda âmbar.

- [ ] **Step 4:** testes PASS. - [ ] **Step 5:** commit `feat: enable BINGO from server count and show my remaining stones`.

### Task 2: Moedas honestas + cartela vencedora (Pacote A3/A4, front)

**Files:** `card-grid.tsx`, `lobby-view.tsx`, `result-dialog.tsx` + testes.

**Interfaces:** Produces `CardGrid({ ..., size?: 'md' | 'sm', label?: string })` — `sm` é somente leitura (células `div` com `aria-label`, grupo `role="group"` com `aria-label={label}`).

- [ ] **Step 1: testes que falham**
  - `lobby-view.test.tsx`: com `coins={0}` → texto `/você ainda joga/i` e `/de graça/i`.
  - `result-dialog.test.tsx`: winner Ana com `grid` e `drawn` contendo 1..5 → `getByRole('group', { name: 'Cartela de Ana' })` e `getByLabelText('B 1, sorteado')`; sem winner → sem grupo.
  - `card-grid.test.tsx`: `size="sm"` não renderiza `button`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementação**
  - Lobby, sem saldo: `Sem moedas para trocar agora — você ainda joga: no início recebe uma cartela de graça. Volte amanhã para o bônus do dia (+{DAILY_COINS}).` Placeholder sem cartela: `Gere uma cartela para ficar pronto. Se não gerar, recebe uma automática no início ({CARD_COST} moedas se tiver saldo; senão, de graça).`
  - ResultDialog: `drawn = useGameStore(s => s.snapshot?.game?.drawn ?? NO_DRAWS)`; `winnerMarked = winner.grid.flatMap((n, i) => (n !== FREE_CELL && drawnSet.has(n) ? [i] : []))`; `<CardGrid size="sm" grid={winner.grid} marked={winnerMarked} drawn={drawnSet} label={`Cartela de ${winner.nickname}`} />`. Rótulo de célula no `sm`: `${letter} ${n}${marcado ? ', sorteado' : ''}`.
- [ ] **Step 4:** PASS. - [ ] **Step 5:** commit `feat: honest no-coins copy and winning card in the result`.

### Task 3: Espectador + partida sem jogadores (Pacote B, back)

**Files:**
- Modify: `src/contracts/events.ts` (`gameEndedReasonSchema = z.enum(['exhausted','no_players'])`; payload `'game:ended': { reason: GameEndedReason }`)
- Modify: `src/game/membership.service.ts` (remove o `throw GAME_IN_PROGRESS`)
- Modify: `src/game/games.service.ts` (+ `endIfNoPlayers`)
- Modify: `src/game/game.gateway.ts` (`endIfAbandoned` após `removeMember` e `onKick`)
- Test: `membership.service.spec.ts`, `games.service.spec.ts`, `game.gateway.spec.ts`, `test/membership.e2e-spec.ts`, `test/games.e2e-spec.ts`

**Interfaces:** Produces `GamesService.endIfNoPlayers(code: string): Promise<string | null>` (id do jogo encerrado); evento `game:ended { reason: 'no_players' }`.

- [ ] **Step 1: testes que falham**
  - unit membership: `joins a room in game as spectator (takes a free slot)` — room `IN_GAME`, members `[]` → `roomMember.create` chamado com slot 0.
  - unit games: `endIfNoPlayers` → (a) sala não `IN_GAME` → null; (b) há card do jogo para membro atual → null sem update; (c) nenhum → `game.updateMany` condicional + `room.update` WAITING, devolve id; (d) updateMany count 0 (corrida) → null.
  - unit gateway: em `onLeave` com `games.endIfNoPlayers` → `'g1'`: `runner.stop('g1')` e `toRoom(code, 'game:ended', { reason: 'no_players' })`; com null nada disso. Idem `onKick`. (Adicionar `endIfNoPlayers: jest.fn().mockResolvedValue(null)` em `makeDeps`.)
  - e2e membership: trocar o caso "in-game" para `join` resolver e `snapshots`/`card` mostrarem que o espectador não tem cartela do jogo.
  - e2e games: jogo com 2 jogadores + 1 espectador; os 2 saem → `endIfNoPlayers` encerra (`FINISHED`, sala `WAITING`); espectador gera cartela no lobby depois.
- [ ] **Step 2:** `npx jest src/game` FAIL.
- [ ] **Step 3: implementação**

```ts
/** Encerra a partida quando nenhum membro atual tem cartela dela (só espectadores sobraram). */
async endIfNoPlayers(code: string): Promise<string | null> {
  return this.prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { code }, include: { members: { select: { userId: true } } } });
    if (!room || room.status !== 'IN_GAME') return null;
    const game = await tx.game.findFirst({ where: { roomId: room.id, status: 'IN_PROGRESS' } });
    if (!game) return null;
    const players = await tx.card.count({ where: { gameId: game.id, userId: { in: room.members.map((m) => m.userId) } } });
    if (players > 0) return null;
    const ended = await tx.game.updateMany({ where: { id: game.id, status: 'IN_PROGRESS' }, data: { status: 'FINISHED', finishedAt: new Date() } });
    if (ended.count !== 1) return null;
    await tx.room.update({ where: { id: room.id }, data: { status: 'WAITING' } });
    return game.id;
  });
}
```

Gateway:

```ts
private async endIfAbandoned(code: string): Promise<void> {
  const gameId = await this.games.endIfNoPlayers(code);
  if (!gameId) return;
  this.runner.stop(gameId);
  this.publisher.toRoom(code, ServerEvents.GAME_ENDED, { reason: 'no_players' });
  this.publisher.publicRoomsChanged();
}
```

Chamado no fim de `removeMember` quando `result.removed && !result.closed`, e em `onKick` depois do `membership.kick`.

- [ ] **Step 4:** `npx jest` + `npm run test:e2e` PASS; `npm run contracts:sync`.
- [ ] **Step 5:** commit back `feat: late joiners watch as spectators; end games nobody is playing`; commit front `feat: sync contracts (game ended reason)`.

### Task 4: Espectador no front (Pacote B, front)

**Files:** `store.ts`, `game-view.tsx`, `result-dialog.tsx` + testes.

**Interfaces:** Produces `selectIsSpectator(state): boolean` (`status === 'IN_GAME' && !myCard`); `GameStoreState.endReason: GameEndedReason | null`.

- [ ] **Step 1: testes que falham**
  - store: `game:ended {reason:'no_players'}` → `endReason === 'no_players'`, `endedWithoutWinner` true; `room:state` zera.
  - game-view: snapshot `IN_GAME` sem `myCard` → texto `/você está assistindo/i`, sem botão BINGO!.
  - result-dialog: espectador (sem `myCard`) vendo vitória de Ana → sem texto de moedas perdidas e com `/você entra na próxima rodada/i`; `no_players` → `/todos os jogadores saíram/i`. Ajustar o teste existente de "others see the coins lost" para ter `myCard`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementação** — reducer `game:ended` grava `endReason: msg.payload.reason`; `GameView`: se espectador, a seção da cartela mostra cartão "👀 Você está assistindo — entra na próxima rodada" e o rodapé troca o BINGO! por um rótulo estático "Assistindo"; `ResultDialog`: `hadCard = !!snapshot?.myCard`; perda só se `hadCard`; descrição para espectador `Você entra na próxima rodada.`; sem vencedor: `endReason === 'no_players' ? 'Todos os jogadores com cartela saíram.' : 'Todos os números saíram sem vencedor.'`.
- [ ] **Step 4:** PASS. - [ ] **Step 5:** commit `feat: spectator view for late joiners`.

### Task 5: Estatísticas do perfil (Pacote C, back)

**Files:** `contracts/profile.ts`, `profiles.service.ts`, `profiles.controller.ts`, `profiles.module.ts`, `ranking.service.ts`, `ranking.module.ts`, `prisma/schema.prisma`, migration nova; testes `profiles.*.spec.ts`, `test/profiles.e2e-spec.ts`.

**Interfaces:** Produces `GET /me/stats → ProfileStats`:

```ts
export const COIN_HISTORY_LIMIT = 20;
export const coinEntrySchema = z.object({ id: z.uuid(), amount: z.number().int(), reason: z.enum(COIN_REASONS), createdAt: z.string() });
export const profileStatsSchema = z.object({
  gamesPlayed: z.number().int(), wins: z.number().int(), points: z.number().int(),
  rank: z.number().int().nullable(), coinHistory: z.array(coinEntrySchema),
});
export type ProfileStats = z.infer<typeof profileStatsSchema>;
```

- [ ] **Step 1: testes que falham** — service: `stats` conta vitórias `FINISHED` com `winnerId`, histórico ordenado `createdAt desc, id desc`, `take: COIN_HISTORY_LIMIT`, `createdAt` ISO; controller: `stats` chama `ensure`, `profiles.stats` e `ranking.position` e combina; e2e: usuário com 1 vitória e transações → resposta bate com o schema, convidado → `rank: null`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementação** — `RankingService.position` vira pública (`position(viewerId)`), módulo exporta; `ProfilesModule` importa `RankingModule`; `@Get('stats')`; índice `@@index([winnerId])` em `Game` + migration `CREATE INDEX "Game_winnerId_idx" ON "Game"("winnerId");`.
- [ ] **Step 4:** PASS (unit + e2e); `contracts:sync`. - [ ] **Step 5:** commits.

### Task 6: Tela de perfil (Pacote C, front)

**Files:** `lib/nickname.ts` (+ `validateNickname`), `features/auth/nickname-form.tsx` (usa), `features/auth/use-logout.ts`, `features/profile/{use-profile-stats.ts,nickname-editor.tsx,stats-grid.tsx,coin-history.tsx,profile-view.tsx}`, `app/(app)/perfil/page.tsx`, `app/(app)/page.tsx`, `features/nav/app-dock.tsx` + testes.

**Interfaces:** `validateNickname(raw: string): { ok: true; value: string } | { ok: false; error: string }`; `useProfileStats(): { state: 'loading' | 'error' | 'ok'; stats: ProfileStats | null; reload(): void }`; `useLogout(): () => Promise<void>`.

- [ ] **Step 1: testes que falham** — `validateNickname` (curto, bloqueado, ok com trim); `NicknameEditor` (editar → salvar chama PATCH `/me` e `refresh`, erro do servidor aparece com `role="alert"`, Cancelar restaura); `StatsGrid` (convidado → "—" e dica); `CoinHistory` (rótulos `Boas-vindas`/`Bônus do dia`/`Cartela`/`Vitória`/`Derrota`, vazio → "Nenhuma movimentação ainda"); `ProfileView` (loading/erro com "Tentar de novo"); dock mostra em `/perfil`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementação** — página com avatar grande, apelido editável, 4 blocos (Partidas, Vitórias, Pontos, Posição), extrato, `UpgradeButton` para convidado, botão Sair; chip do topo da Home vira `Link href="/perfil"` (`aria-label="Abrir seu perfil"`).
- [ ] **Step 4:** PASS. - [ ] **Step 5:** commit `feat: profile screen with nickname, stats and coin history`.

### Task 7: Emotes (Pacote D, back)

**Files:** `contracts/events.ts`, `game.gateway.ts`, spec.

**Interfaces:**

```ts
export const EMOTES = ['clap', 'wow', 'laugh', 'fire'] as const;
export const emoteSchema = z.enum(EMOTES);
export type Emote = z.infer<typeof emoteSchema>;
export const EMOTE_SYMBOLS: Record<Emote, string> = { clap: '👏', wow: '😱', laugh: '😂', fire: '🔥' };
export const emotePayloadSchema = z.object({ emote: emoteSchema });
// ClientEvents.ROOM_EMOTE = 'room:emote'; ServerEvents.EMOTED = 'room:emoted' → { userId: string; emote: Emote }
// ClientAckData['room:emote'] = null
```

- [ ] **Step 1: testes que falham** — gateway: emote válido → `publisher.toRoom(code, 'room:emoted', { userId, emote })`, ack `{ ok: true, data: null }`; emote fora do enum → `INVALID_PAYLOAD`; fora de sala → `NOT_IN_ROOM`; segundo emote em < 1,5 s → `RATE_LIMITED` sem publicar.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `LIMITS.emote = { suffix: ':emote', limit: 1, windowMs: 1_500 }`; handler `onEmote`.
- [ ] **Step 4:** PASS; `contracts:sync`. - [ ] **Step 5:** commits.

### Task 8: Emotes (Pacote D, front)

**Files:** `store.ts` (`reactions`, `reactionSeq`, `dismissReaction`), `use-game-connection.ts` (`emote`), `features/game/emotes/{labels.ts,emote-picker.tsx,reaction-feed.tsx}`, `scene3d/{emote-bubble.ts,emote-bubbles.tsx}`, `game-stage.tsx`, `lobby-stage.tsx`, `game-view.tsx`, `lobby-view.tsx`; testes.

**Interfaces:** `Reaction = { id: number; userId: string; emote: Emote }`; `MAX_REACTIONS = 12`; `REACTION_MS = 2600`; `GameActions.emote(emote: Emote): Promise<void>` (erro silencioso); `latestPerUser(reactions): Reaction[]`; `bubbleFrame(t: number): { visible: boolean; rise: number; opacity: number; scale: number }`.

- [ ] **Step 1: testes que falham** — reducer: `room:emoted` de membro entra com ids crescentes, de não-membro é ignorado, lista limitada a 12; `dismissReaction`; `latestPerUser` mantém só o último de cada um; `bubbleFrame(0)` escala 0, `bubbleFrame(0.5)` visível opaco, `bubbleFrame(1)` invisível; `EmotePicker` abre, envia `clap`, fecha e trava 1,5 s (fake timers); `ReactionFeed` mostra "Ana" + 👏 e some após `REACTION_MS`; `emote` em `use-game-connection` não chama `toast` em erro.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** implementação (feed DOM nos dois modos; bolha 3D = `sprite` com `CanvasTexture` cacheada por emote, posicionada por `pose()` acima do rótulo).
- [ ] **Step 4:** PASS. - [ ] **Step 5:** commit `feat: live emotes over the avatars`.

### Task 9: Narração (Pacote E, front)

**Files:** `sound/use-persisted-flag.ts`, `sound/use-muted.ts` (usa o flag), `sound/narration.ts`, `sound/use-narration.ts`, `sound/narration-toggle.tsx`, `room-screen.tsx`, `game-view.tsx`; testes.

**Interfaces:** `usePersistedFlag(key: string): [boolean, (v: boolean) => void]`; `ballPhrase(n: number): string` → `"B, 7"`; `createNarrator(env: { synth: SpeechLike | null; utter: (text: string) => UtteranceLike }): Narrator` com `{ supported: boolean; speak(text: string): void }`; `sharedNarrator()`; `useNarration(enabled: boolean, narrator?: Narrator)`.

- [ ] **Step 1: testes que falham** — `ballPhrase(7) === 'B, 7'`, `ballPhrase(75) === 'O, 75'`; narrator cancela a fala anterior, usa `lang = 'pt-BR'` e voz pt-BR se houver; sem synth → `supported: false` e `speak` no-op; `useNarration`: primeiro estado silencioso, cada bola nova fala, reconectando zera a base, `enabled=false` não fala; toggle: liga e fala "Narração ligada"; escondido sem suporte; `useMuted` continua persistindo em `go-bingo:muted`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** implementação; `RoomScreen` passa `narration`/`onToggleNarration`; `useNarration(!muted && narration)`.
- [ ] **Step 4:** PASS. - [ ] **Step 5:** commit `feat: optional voice narration of each ball`.

### Task 10: Verificação final

- [ ] back: `npm run lint && npm run typecheck && npm run test:cov && npm run test:e2e`
- [ ] front: `npm run lint && npm run typecheck && npm run test:cov && npm run build && npm run check:bundle`
- [ ] README do front: seção "Melhorias de UX" com checklist manual (2 abas: BINGO sem marcar; atrasado assiste; perfil; emotes; narração).
- [ ] Revisão final do branch inteiro (reviewer).
