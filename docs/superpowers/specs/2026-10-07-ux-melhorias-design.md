# Melhorias de experiência do jogador — design

| Campo | Valor |
|---|---|
| Data | 2026-10-07 |
| Status | Aguardando revisão do Gustavo |
| Origem | Brainstorm "quais melhorias dá pra fazer pra deixar a experiência melhor" — decisões tomadas pelo agente com o usuário ausente; tudo aqui é revisável. |
| Repos | `go-bingo-front` (principal) · `go-bingo-back` (pacotes B–D) |

## 1. Entendimento

**O que foi pedido:** levantar melhorias de UX para a plataforma e decidir o que fazer.

**Assumido (corrigir se errado):**

- Público principal continua o do PRD §2.2: grupo de amigos, celular em retrato, entra por link do WhatsApp, muitas vezes como convidado.
- Sucesso = menos momentos de "travei / perdi sem entender / não consegui entrar" e mais rodadas por sessão (PRD §1.4: partidas concluídas ≥ 85%).
- A escolha de design "a cartela não mostra o que já saiu; quem não presta atenção esquece de marcar" (`card-grid.tsx`) é intencional e **fica**.

## 2. Problemas encontrados no código

| # | Problema | Onde | Impacto |
|---|---|---|---|
| P1 | Botão **BINGO!** só acende com todas as casas marcadas localmente, mas o servidor valida por números **sorteados** e o painel "Pedras que faltam" também conta por sorteados. O jogador pode ver a si mesmo com **0** no painel e o botão apagado. Contraria o PRD US-4.4 ("o jogador não perde por não ter tocado num número que já saiu"). | `store.ts` `selectCanClaim` × `games.service.ts` `remainingFor` | Alto — perde a partida tendo bingo. |
| P2 | Quem abre o link com a partida em andamento recebe "Partida em andamento" e fica de fora. No fluxo WhatsApp, o atrasado é comum. | `membership.service.ts:45` | Alto — o amigo desiste. |
| P3 | Lobby diz "Moedas insuficientes" e desabilita o botão, mas no início o servidor dá a cartela mesmo sem saldo (`chargeUpTo`). O jogador acha que não pode jogar. | `lobby-view.tsx` × `games.service.ts:90` | Médio — abandono no lobby. |
| P4 | O resultado não mostra a cartela vencedora, embora o `Winner` já traga `grid`. Sem prova visual, a vitória alheia parece arbitrária. | `result-dialog.tsx` | Médio — confiança. |
| P5 | Não há tela de perfil: apelido não pode ser trocado (PRD US-1.2 diz que pode), sem estatísticas, sem extrato de moedas (a tabela `CoinTransaction` já existe), "Sair" escondido no fim da Home. | — | Médio — retenção. |
| P6 | Presença social durante a partida é passiva (só bonecos). Sem reação rápida (PRD US-4.3 emotes, P1). | — | Médio — o diferencial do produto. |
| P7 | Jogador precisa olhar a tela a cada bola; sem narração ("B 7") para quem está na chamada de vídeo com o celular de lado (PRD US-4.1, P1). | `sound/` | Baixo/médio. |
| P8 | Avatar não é personalizável (PRD US-2.1 P1). | `avatar-look.ts` | Baixo — vaidade, mas engaja. |

## 3. Decomposição em pacotes

Cada pacote vira spec → plano → implementação próprios. Ordem = impacto ÷ esforço.

| Pacote | Resolve | Repos | Esforço | Detalhado aqui? |
|---|---|---|---|---|
| **A — Partida sem frustração** | P1, P3, P4 | front | P | **Sim (§4)** |
| B — Espectador e entrar na próxima rodada | P2 | back + front | M | Esboço (§5.1) |
| C — Tela de perfil | P5 | back + front | M | Esboço (§5.2) |
| D — Emotes ao vivo | P6 | back + front | M | Esboço (§5.3) |
| E — Narração das bolas | P7 | front | P | Esboço (§5.4) |
| F — Personalizar avatar | P8 | back + front | G | Esboço (§5.5) |

**Fora (YAGNI por agora):** marcação automática (mata o "prestar atenção" que é o jogo), chat de texto (moderação), penalidade por bingo inválido (com P1 resolvido, bingo inválido praticamente some), pódio 3D no ranking.

## 4. Pacote A — Partida sem frustração (detalhado)

Só front. Sem mudança de contrato nem de back.

### A1. BINGO! acende pelo servidor (P1)

**Decisão:** o botão fica habilitado quando `remaining[meuId] === 0` (vindo de `game:progress`/snapshot) **ou** quando a marcação local já fecha o padrão (cobre o intervalo entre o sorteio e o próximo `game:progress`).

- `selectCanClaim` em `features/game/store.ts` passa a checar primeiro `snapshot.game.remaining[myUserId] === 0`; mantém a regra atual de marcação como segundo caminho.
- Por que não "só marcação": o servidor não exige marcação; o painel público já revela que o jogador está com 0. Exigir marcação só cria a situação "tinha bingo e perdeu".
- Por que mantém a cartela sem destacar sorteados: continua sendo o jogo de prestar atenção para **marcar**; o que muda é que o pedido de BINGO não fica refém de um toque esquecido.
- Quando o botão acende por `remaining === 0` sem marcação completa, ele pulsa igual (sem texto extra — o próprio botão aceso é o aviso).

**Testes (Vitest):** `store.test.ts` — (a) remaining 0 + nada marcado → true; (b) remaining 2 + tudo marcado (padrão fechado localmente) → true; (c) remaining 1 + marcação incompleta → false; (d) status ≠ IN_GAME → false. `game-view.test.tsx` — botão habilitado no caso (a).

### A2. Mostrar quanto me falta (P1, complemento)

**Decisão:** o botão "Pedras que faltam" do rodapé ganha o número do próprio jogador como badge: `Faltam 3` / `Por 1!` (âmbar) — dado que ele já veria abrindo o diálogo.

- `remaining-panel.tsx` recebe `myUserId` e mostra o badge no gatilho; o diálogo continua igual, com a minha linha destacada ("você").
- Sem badge quando não tenho cartela.

**Testes:** `remaining-panel` — badge com o valor do jogador; "Por 1!" quando 1; linha "você" no diálogo.

### A3. Texto honesto sobre moedas no lobby (P3)

**Decisão:** sem saldo para trocar/gerar, o botão continua desabilitado, mas o texto vira:
"Sem moedas para trocar agora — você ainda joga: no início recebe uma cartela de graça. Bônus do dia: +50 amanhã." (usar `DAILY_COINS`).

- Ajustar também o placeholder de "sem cartela": "...recebe uma automática no início (custa {CARD_COST} moedas se tiver saldo; senão, sai de graça)."

**Testes:** `lobby-view.test.tsx` — com `coins < CARD_COST` mostra a mensagem nova.

### A4. Cartela vencedora no resultado (P4)

**Decisão:** o `ResultDialog` mostra a cartela do vencedor em miniatura (somente leitura), com as casas sorteadas marcadas, quando há `winner`.

- Reusar `CardGrid` com uma prop `size="sm"` (classes menores: bolas `w-6`, casas `min-h-8 text-sm`) — sem `onMark`; `marked` = índices cujo número está em `drawn` (+ casa livre). Para quina, destacar a linha vencedora é um extra: **não** entra (YAGNI); mostrar marcados já prova.
- Esconder a miniatura quando o vencedor sou eu? Não — mostrar também, é a "foto" da vitória.
- `drawn` vem do store (`snapshot.game.drawn`).

**Testes:** `result-dialog.test.tsx` — com winner, renderiza a grade com rótulos "marcado" nas casas sorteadas; sem winner, não renderiza.

### Critérios de saída do Pacote A

- `npm test`, `npm run typecheck`, `npm run lint` verdes; cobertura ≥ 80%.
- Teste manual em 2 abas: jogador que não marca nada consegue pedir BINGO quando o painel mostra 0, e vence.

## 5. Esboço dos próximos pacotes

### 5.1 B — Espectador e entrar na próxima rodada

- Entrar numa sala `IN_GAME` (com vaga) vira **espectador**: recebe snapshot sem `myCard`, vê palco, últimos números, painel e quem está por 1. Boneco aparece na plateia com marca de "assistindo".
- Ao "Jogar de novo", espectadores viram membros normais no lobby.
- Back: `RoomMember.role` (`PLAYER`/`SPECTATOR`) ou flag `joinedMidGame`; `membership.service` aceita entrada em `IN_GAME`; `remaining`/`progress` ignoram quem não tem cartela; limite de vagas conta espectadores.
- Front: `GameView` sem cartela mostra faixa "Você está assistindo — entra na próxima rodada".

### 5.2 C — Tela de perfil (`/perfil`, 4ª aba no dock)

- Trocar apelido (mesma regra do `/nickname`), estatísticas (partidas, vitórias = `count(Game where winnerId)`, pontos, posição no ranking), extrato das últimas 20 movimentações de moedas, botão de vincular Google (convidado) e "Sair".
- Back: `GET /profiles/me/stats`, `GET /profiles/me/coins?limit=20`, `PATCH /profiles/me` (apelido).

### 5.3 D — Emotes ao vivo

- 4 emotes fixos (👏 😱 😂 🔥) num botão da HUD; evento `room:emote` → broadcast `room:emote` na sala; balão sobre o boneco no 3D e toast curto no 2D.
- Rate limit no gateway (1 a cada 2 s por usuário); sem texto livre.

### 5.4 E — Narração das bolas

- `speechSynthesis` pt-BR ("B, sete"), ligado/desligado ao lado do mudo, persistido como o mudo; desligado por padrão; respeita o mudo geral. Só front.

### 5.5 F — Personalizar avatar

- Cor do corpo, chapéu e expressão escolhidos no perfil (C), salvos no `Profile`; `avatar-look.ts` usa o salvo e cai no determinístico por id. Depende de C.

## 6. Riscos

- **A1 muda a "dificuldade" percebida.** Quem gostava de "punir quem não marca" perde isso. Mitigação: é exatamente o que o PRD pede; se quiser o oposto, a alternativa é o servidor passar a exigir marcação (mudança de regra, não de UI).
- **B mexe na regra de lotação e no fluxo de entrada** — maior risco de regressão; exige e2e novo.
