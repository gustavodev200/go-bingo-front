# Jogadores (personagens) e camisas

O personagem é um jogador de futebol low-poly. Cada jogador escolhe um **rosto** (uma personalidade engraçada), uma **camisa** e um **número nas costas**. O perfil guarda tudo num código curto, e salas e sockets repassam esse mesmo código. Nenhum modelo 3D ou textura trafega pela rede.

## Código do personagem

`<rosto><camisa><número>`, por exemplo `afla10` = rosto `a` (Craque), camisa do Flamengo, número 10. `00` = sem número.

- Ids e validação ficam no contrato do back, `src/contracts/profile.ts` (`CHARACTER_FACES`, `JERSEY_IDS`, `parseCharacter`, `encodeCharacter`). O back guarda o código em `Profile.character` (`VarChar(8)`).
- Código desconhecido (por exemplo os antigos `c01..c17`) ou ausente mostra o **jogador padrão**: rosto, camisa original da comunidade e número derivados do id do usuário. Todo aparelho vê o mesmo boneco.
- O nome nas costas é o apelido (sem acento, maiúsculo, até 12 caracteres). As camisas temáticas (`lul`, `bol`) imprimem o próprio nome.

## Onde fica cada coisa (front)

| Arquivo | O que faz |
| --- | --- |
| `features/game/scene3d/jerseys.ts` | Catálogo de camisas (cores, padrão, gola, mangas, calção, meião, tinta do número, escudo genérico) |
| `features/game/scene3d/avatar-look.ts` | Os 12 rostos (pele, cabelo, olhos, sobrancelha, boca, extras, chuteira) e o jogador padrão |
| `features/game/scene3d/characters.ts` | `lookFor(userId, código, apelido)`: código → aparência (memoizado) |
| `features/game/scene3d/avatar-geometry.ts` | Geometria low-poly procedural, compartilhada por todos os jogadores |
| `features/game/scene3d/jersey-shader.ts` | Shader da camisa: padrão, escudo, número e nome por instância |
| `features/game/scene3d/avatar-crowd.tsx` | Desenha todos os jogadores da sala (1 `InstancedMesh` por peça) |
| `features/game/scene3d/character-stage.tsx` | Vitrine 3D (arrastar gira, frente/costas) |
| `features/profile/character-picker.tsx` | Seletor: rostos, coleções, busca, número, voltar ao padrão |
| `components/stage/avatar.tsx` | Versão em CSS (lobbies, mesas, listas) com o mesmo rosto e camisa |

## Adicionar uma camisa (sem mexer no personagem)

1. **Back:** acrescente o id de 3 letras no fim de `JERSEY_IDS` em `go-bingo-back/src/contracts/profile.ts`. Nunca remova nem renomeie um id: perfis salvos apontam para ele. Rode `npm run contracts:sync` e no front mantenha só a mudança de `profile.ts`.
2. **Front:** acrescente a entrada em `JERSEYS` (`jerseys.ts`). Se faltar algum id, o TypeScript não compila:

   ```ts
   abc: { name: 'Meu Clube', category: 'comunidade', primary: '#123456', secondary: '#ffffff', accent: '#fde047', pattern: 'stripes', stripes: 8, shorts: '#111111', socks: '#123456', badge: '#fde047' },
   ```

   - `pattern`: `solid`, `stripes`, `hoops`, `sash`, `halves`, `tricolor`, `bands`, `chevron`, `star`, `diamond` ou `pinstripes`. `stripes` define quantas listras cabem no tronco.
   - Campos opcionais: `collar` (padrão: secundária), `sleeves` (padrão: primária), `ink` (cor do número; padrão: preto ou branco, o que contrastar), `backName`, `defaultNumber`. `badge: null` = sem escudo.
   - Categoria nova: acrescente em `JERSEY_CATEGORIES` e ela vira uma aba no seletor.
3. Padrão novo: um ramo em `FRAGMENT_MAIN` (`jersey-shader.ts`), um em `jerseyBackground` (`avatar.tsx`) e o nome no **fim** de `JERSEY_PATTERNS` (o shader usa o índice).

Rosto novo funciona igual: uma letra em `CHARACTER_FACES` (back) e uma entrada em `FACES` (front).

## Escudos, patrocínios e fidelidade

As cores e padrões seguem o visual geral do uniforme 1 de cada clube; **não são réplicas oficiais**. O escudo no peito é um marcador genérico na cor do clube, e nenhum escudo ou patrocinador protegido foi incluído. Para usar escudos reais é preciso ter os arquivos licenciados, guardá-los no projeto (nunca por URL externa) e criar um slot de textura no shader. Isso não está implementado hoje.

A lista da Série A 2026 foi conferida com a relação de participantes divulgada: 20 clubes, com Coritiba, Athletico-PR, Chapecoense e Remo subindo.

## Desempenho (medido)

- **Download:** 0 KB de assets 3D. A geometria é montada em código quando a cena abre (não há `.glb`, então não há o que comprimir com Draco ou Meshopt). A única textura é o atlas de glifos (512×320), desenhado num canvas uma vez por cena.
- **Triângulos por jogador:** 2,1 mil a 2,6 mil conforme o rosto (corpo-base 2.064). Um teste trava o limite em < 5 mil.
- **Draw calls:** um por tipo de peça em uso (corpo, cabeça, cada estilo de boca/cabelo/extra), compartilhado pela sala inteira. Mais jogadores aumentam instâncias, não draw calls. Estilos que ninguém usa ficam com `count = 0` e não são desenhados.
- **Trocar de camisa** reescreve 5 vec4 da instância: sem material novo, sem textura, sem recompilar. Os materiais são criados uma vez por cena; geometrias e atlas são descartados ao desmontar.
- O resto da cena (`frameloop="demand"`, FPS ocioso, nível de qualidade, sombras no celular, DPR) segue o palco que já existia (`quality.ts`, `frame-driver.tsx`).

A vitrine foi conferida no Chrome com WebGL (SwiftShader) no desktop e em 390 px de largura: frente, costas, todos os rostos e camisas, sem erro de shader.
