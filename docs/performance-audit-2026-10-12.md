# Auditoria de performance — mobile e bateria (2026-10-12)

## Resumo

O gasto contínuo vinha de **trabalho repetido a cada vsync, mesmo sem nada mudando na tela**:

1. **Cenas 3D em `frameloop="always"`** — renderizavam na taxa da tela (60/90/120/165 Hz), inclusive com o canvas rolado para fora da tela no lobby.
2. **Fundo CSS global animado com propriedades caras** (no layout raiz, presente em todas as páginas): `background-position` animado (repaint por quadro), `filter: blur` + `mix-blend-mode` em camadas de tela cheia, sob vários painéis com `backdrop-filter`.
3. **Truco**: brilho de "vez de jogar" animando `box-shadow` em loop infinito (repaint durante a partida inteira) e selo "mão de ferro" animando `filter`.
4. **`AudioContext` ligado para sempre** depois do primeiro efeito sonoro (mantém o áudio do aparelho processando silêncio).

## Método e limitações

- Harness temporário (página local com o `LobbyStage` real, 12 bonecos, e o `/login`) medido com Playwright + CDP: frames WebGL (contagem de `clear`), draw calls, `TaskDuration`/`ScriptDuration` e eventos `Paint` do trace, janelas de 8 s. O harness foi removido depois.
- Viewport de celular (412×915, DPR 2,625) em `next dev`, Chromium headless com **GPU real (RTX 2060 via ANGLE/D3D11)**. O headless roda o rAF sem vsync (~165 Hz), parecido com telas de 120/165 Hz.
- **Sem dispositivo físico e sem medição de bateria.** Os números abaixo são indicadores indiretos (frames, draw calls, CPU, paints); eles **não** são uma medida de autonomia. Não há percentual de economia de bateria afirmado. Em celular real o ganho por frame é maior (GPU mais fraca), mas isso precisa ser confirmado em aparelho.

## Métricas antes/depois (mesmo harness, mesmas condições)

| Cenário | FPS WebGL | Draw calls/s | CPU (ms/s) | Paints/s |
| --- | --- | --- | --- | --- |
| `/login` ocioso (só fundo CSS) | — | — | 136 → **11** | 288 → **0** |
| Lobby 3D ocioso, qualidade Equilibrada | 164 → **32** | 14 619 → **2 844** | 381 → **73** | 288 → **0** |
| Lobby 3D rolado para fora da tela, Equilibrada | 165 → **0** | 14 694 → **0** | 370 → **4** | 288 → **0** |
| Lobby 3D ocioso, Economia | 164 → **21** | 13 657 → **1 768** | 342 → **54** | 288 → **0** |
| Lobby 3D fora da tela, Economia | 165 → **0** | 13 706 → **0** | 343 → **1** | 288 → **0** |

Resposta a evento (jogador entrando na sala), FPS em janelas de 250 ms: `~30 (ocioso) → 60 durante a caminhada e o reenquadramento da câmera (~2,7 s) → ~30`.

## O que mudou

### 3D (React Three Fiber)

- **`frameloop="demand"` + `FrameDriver`** (`scene3d/frame-driver.tsx`): um rAF próprio pede quadros (`invalidate`) no teto do perfil e **para de vez** com a aba oculta (`visibilitychange`) ou o canvas fora da tela (`IntersectionObserver`).
- **FPS ativo × ocioso** (`scene3d/stage-activity.ts`): componentes pedem o FPS ativo só quando há movimento de verdade:
  - globo: sorteio novo (arranque + voo da bola, `BALL_SHOW_MS`);
  - bonecos: andando (entrada/saída), pulo de pronto, dança/vitória (vitória com teto ativo só nos 8 s iniciais);
  - câmera: arrasto, volta com mola, troca de enquadramento, deslize até o vencedor;
  - confete: 8 s iniciais.
  - Respirar, piscar, holofotes, lâmpadas e o giro lento do globo seguem no FPS ocioso.
- **Tetos por perfil** (`quality.ts`), em que nenhum perfil passa de 60 FPS:

  | Perfil | Interno | Ativo | Ocioso | DPR máx. | Sombras | Extras |
  | --- | --- | --- | --- | --- | --- | --- |
  | Alta | `high` | 60 | 30 | 2 | reais | holofotes, partículas 90, confete 300 |
  | Equilibrada | `medium` | 60 | 30 | 2 | falsas | holofotes, partículas 45, confete 120 |
  | Economia de bateria | `low` | 30 | 20 | 1,5 | nenhuma | sem holofotes/partículas/confete, lâmpadas fixas |

- **Qualidade adaptativa por condição real** (`scene3d/frame-pacing.ts`): o `PerformanceMonitor` do drei saiu, porque com teto de FPS ele leria "30 FPS" como aparelho fraco. O monitor novo compara os quadros **entregues com o teto pedido**:
  - desce após 2 janelas seguidas de 1 s abaixo de 80% do teto;
  - espera 2 s para o novo DPR assentar;
  - sobe no máximo 1 vez;
  - para de adaptar após 3 trocas de direção (histerese);
  - pausas não contam como lentidão.
  - Efeito colateral desejado: no Modo de Pouca Energia do iOS (rAF a 30 Hz), a cena desce sozinha até o perfil de economia.
- **`powerPreference: 'default'`** (antes `'high-performance'`): evita acordar a GPU dedicada em notebooks híbridos.
- **Vitrine de personagem** (`character-stage.tsx`, perfil/apelido): mesma estratégia (`demand`, 30 ocioso / 60 no pulo e na dança, pausa fora da tela).

### CSS

- `components/stage/stage.module.css`:
  - chão do palco desliza com `transform` num pseudo-elemento, em vez de animar `background-position`;
  - holofotes sem `filter: blur` e sem `mix-blend-mode`. O blur era quase invisível: o `clip-path` é aplicado depois do filtro e corta as bordas suaves;
  - lâmpadas do letreiro animam só `opacity`, sobre uma camada acesa.
- Fundo **pausa enquanto um palco 3D está montado** (`<html data-stage>`), porque fica quase todo atrás do canvas.
- `features/truco/truco.module.css`: "vez de jogar" e "mão de ferro" passam a pulsar por `opacity` de uma camada de brilho.

### Áudio

- `sound/sfx-player.ts`: o `AudioContext` é suspenso 3 s depois do último efeito e retomado no próximo som. O áudio já liberado por gesto continua contando como liberado.

### Modo economia de bateria (usuário)

- Interruptor **"Economia de bateria"** no perfil. Também aparece como opção "Economia de bateria" no seletor de qualidade 3D da sala; os rótulos viraram Automática/Alta/Equilibrada/Economia de bateria.
- Ligado, ele fixa o perfil `low` e marca `<html data-power-save>` (`features/game/power-save.tsx`), o que para toda a decoração CSS animada do salão.

## Impacto visual

- **Personagens, modelos, materiais, cores, texturas, sombras e efeitos por perfil**: sem alteração.
- **Fluidez**: movimentos com teto ativo seguem a 60 FPS. Animações ambientes passam a 30 FPS (20 no modo economia).
- **Fundo CSS**: comparação de pixels com as animações congeladas no mesmo instante deu diferença média de 3,9/255 e máxima de 24/255, só nos feixes de luz (efeito de trocar o blend `screen` por alfa normal). Lado a lado não se distingue.
- **Com o palco 3D montado**, holofotes e chão do fundo CSS ficam parados (estão atrás do canvas).
- **Truco**: o anel da vez agora fica fixo em 0,8 de opacidade (antes oscilava entre 0,6 e 0,9). Só o halo largo pulsa.

## Testes

- Vitest: 98 arquivos / 548 testes passando (antes: 95 / 532). Typecheck (`tsc --noEmit`), ESLint, `next build` e `check:bundle` (three.js segue isolado nos chunks da sala) sem erros.
- E2E (Playwright) não executado: depende do backend NestJS + Supabase.
- Testes novos:
  - `frame-pacing.test.ts`: teto em 60/90/120/165 Hz, cadência, sem rajada após pausa, monitor sem falso positivo a 30/30, histerese, flip-flop;
  - `stage-activity.test.ts`;
  - `power-save.test.tsx`;
  - interruptor em `profile-view.test.tsx`;
  - suspensão por ociosidade em `sfx-player.test.ts`.

## Ainda exige investigação

1. **Medição em aparelho físico** (Android 120 Hz e iPhone): bateria em sessão controlada (mesmo brilho, rede, duração), temperatura, FPS real, e validar a nitidez do DPR 2 no perfil Equilibrado.
2. **Telemetria `fpsP50`** (Sentry `session-summary`): com o teto de FPS ela passa a refletir o ritmo pedido (~30 em ocioso), não a capacidade do aparelho. Alertas baseados nela precisam ser revistos; o ideal é reportar a razão entregue/teto.
3. **Painéis `glass`/`backdrop-blur` sobre o fundo animado** (páginas sem 3D): os paints zeraram, mas o compositor ainda refaz o desfoque desses painéis a cada quadro enquanto holofotes e chão se movem. Opções: parar o fundo após um tempo ocioso, ou desfoque menor no dock.
4. **Alocações por quadro no `AvatarCrowd`** (arrays/objetos em `pose()`, `at()` e `forEach`): o custo caiu com o FPS menor, mas dá para zerar o lixo por quadro se o profiling em aparelho apontar GC.
5. **`useAvatarStates`** recalcula a coreografia a cada 150 ms mesmo sem mudança (barato; poderia agendar só a próxima expiração de fase).
6. **Re-renders do React**: por evento do servidor (sorteio/marcação), sem loop contínuo encontrado. Falta um profiling com React DevTools numa partida real.
