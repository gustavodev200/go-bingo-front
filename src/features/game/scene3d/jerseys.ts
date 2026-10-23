import { JERSEY_IDS, type JerseyId } from '@/contracts';

/**
 * Padrões da camisa, todos desenhados no shader a partir da posição no tronco (nada de textura por time):
 * listras verticais, faixas horizontais, faixa diagonal, metades, listras tricolores, faixas no peito, V, estrela,
 * losango e risca de giz.
 */
export const JERSEY_PATTERNS = ['solid', 'stripes', 'hoops', 'sash', 'halves', 'tricolor', 'bands', 'chevron', 'star', 'diamond', 'pinstripes'] as const;
export type JerseyPattern = (typeof JERSEY_PATTERNS)[number];

export const JERSEY_CATEGORIES = [
  { id: 'brasileirao', label: 'Brasileirão 2026' },
  { id: 'internacional', label: 'Internacionais' },
  { id: 'tematica', label: 'Políticas' },
  { id: 'comunidade', label: 'Originais' },
] as const;
export type JerseyCategory = (typeof JERSEY_CATEGORIES)[number]['id'];

export interface Jersey {
  id: JerseyId;
  name: string;
  category: JerseyCategory;
  /** Cor base da camisa. */
  primary: string;
  /** Cor do padrão (listras, faixa, estrela...). */
  secondary: string;
  /** Terceira cor: filete das tricolores, miolo do losango, aro do escudo. */
  accent: string;
  pattern: JerseyPattern;
  /** Quantas listras/faixas cabem no tronco (padrões listrados). */
  stripes?: number;
  /** Gola; padrão = secundária. */
  collar?: string;
  /** Mangas; padrão = primária. */
  sleeves?: string;
  shorts: string;
  socks: string;
  /** Número e nome nas costas; padrão = branco ou preto, o que contrastar com a primária. */
  ink?: string;
  /** Escudo genérico no peito (cor); null = sem escudo. Não reproduz escudo oficial: é um marcador no lugar. */
  badge: string | null;
  /** Nome fixo nas costas (camisas temáticas); senão vai o apelido do jogador. */
  backName?: string;
  /** Número sugerido ao escolher a camisa. */
  defaultNumber?: number;
}

type JerseyDef = Omit<Jersey, 'id'>;

const W = '#ffffff';
const K = '#111111';

/**
 * Catálogo: cores e padrões gerais do uniforme 1 de cada clube (inspirados, não réplicas oficiais; escudos e
 * patrocinadores ficam de fora — o escudo é um marcador genérico). Ordem = ordem do seletor.
 * Série A 2026 conferida com a lista de participantes divulgada (20 clubes, sobem Coritiba, Athletico, Chape e Remo).
 * Um id novo no contrato sem entrada aqui não compila.
 */
export const JERSEYS: Record<JerseyId, JerseyDef> = {
  fla: { name: 'Flamengo', category: 'brasileirao', primary: '#c4122e', secondary: K, accent: W, pattern: 'hoops', stripes: 7, collar: K, sleeves: K, shorts: W, socks: '#c4122e', badge: '#c4122e' },
  pal: { name: 'Palmeiras', category: 'brasileirao', primary: '#006437', secondary: W, accent: W, pattern: 'solid', collar: W, shorts: W, socks: '#006437', badge: W },
  cru: { name: 'Cruzeiro', category: 'brasileirao', primary: '#0033a0', secondary: W, accent: W, pattern: 'solid', shorts: W, socks: '#0033a0', badge: W },
  mir: { name: 'Mirassol', category: 'brasileirao', primary: '#ffd200', secondary: '#00733c', accent: '#00733c', pattern: 'solid', sleeves: '#ffd200', shorts: '#00733c', socks: '#ffd200', ink: '#00733c', badge: '#00733c' },
  flu: { name: 'Fluminense', category: 'brasileirao', primary: '#7a1631', secondary: '#00613c', accent: W, pattern: 'tricolor', stripes: 5, collar: W, sleeves: '#7a1631', shorts: W, socks: W, badge: W },
  bah: { name: 'Bahia', category: 'brasileirao', primary: W, secondary: '#004b9b', accent: '#d71920', pattern: 'bands', collar: '#004b9b', shorts: '#004b9b', socks: W, ink: '#004b9b', badge: '#004b9b' },
  bot: { name: 'Botafogo', category: 'brasileirao', primary: K, secondary: W, accent: W, pattern: 'stripes', stripes: 9, collar: K, sleeves: K, shorts: K, socks: '#6b7280', badge: K },
  spa: { name: 'São Paulo', category: 'brasileirao', primary: W, secondary: '#e30613', accent: K, pattern: 'bands', collar: K, shorts: W, socks: W, ink: K, badge: '#e30613' },
  rbb: { name: 'Red Bull Bragantino', category: 'brasileirao', primary: W, secondary: '#d6001c', accent: '#0b1f4b', pattern: 'chevron', collar: '#d6001c', shorts: W, socks: W, ink: '#d6001c', badge: '#d6001c' },
  cor: { name: 'Corinthians', category: 'brasileirao', primary: W, secondary: K, accent: K, pattern: 'solid', collar: K, shorts: K, socks: W, ink: K, badge: K },
  gre: { name: 'Grêmio', category: 'brasileirao', primary: '#0d80bf', secondary: K, accent: W, pattern: 'tricolor', stripes: 6, collar: K, sleeves: K, shorts: K, socks: W, badge: '#0d80bf' },
  vas: { name: 'Vasco da Gama', category: 'brasileirao', primary: K, secondary: W, accent: '#d4001c', pattern: 'sash', collar: W, shorts: K, socks: K, badge: '#d4001c' },
  cam: { name: 'Atlético Mineiro', category: 'brasileirao', primary: K, secondary: W, accent: '#f5c400', pattern: 'stripes', stripes: 13, collar: K, sleeves: W, shorts: K, socks: W, badge: '#f5c400' },
  san: { name: 'Santos', category: 'brasileirao', primary: W, secondary: K, accent: K, pattern: 'solid', collar: K, shorts: W, socks: W, ink: K, badge: K },
  int: { name: 'Internacional', category: 'brasileirao', primary: '#e5050f', secondary: W, accent: W, pattern: 'solid', shorts: W, socks: '#e5050f', badge: W },
  cfc: { name: 'Coritiba', category: 'brasileirao', primary: W, secondary: '#00553a', accent: '#00553a', pattern: 'hoops', stripes: 4, collar: '#00553a', sleeves: W, shorts: K, socks: W, ink: '#00553a', badge: '#00553a' },
  cap: { name: 'Athletico Paranaense', category: 'brasileirao', primary: '#d50a12', secondary: K, accent: W, pattern: 'hoops', stripes: 11, collar: K, sleeves: '#d50a12', shorts: K, socks: K, badge: K },
  cha: { name: 'Chapecoense', category: 'brasileirao', primary: '#00843d', secondary: W, accent: W, pattern: 'solid', collar: W, shorts: W, socks: '#00843d', badge: W },
  rem: { name: 'Remo', category: 'brasileirao', primary: '#00205b', secondary: W, accent: W, pattern: 'pinstripes', stripes: 14, collar: W, shorts: W, socks: '#00205b', badge: W },
  vit: { name: 'Vitória', category: 'brasileirao', primary: '#e30613', secondary: K, accent: W, pattern: 'hoops', stripes: 5, collar: K, sleeves: '#e30613', shorts: W, socks: K, badge: W },

  rma: { name: 'Real Madrid', category: 'internacional', primary: W, secondary: '#febe10', accent: '#00529f', pattern: 'solid', collar: '#00529f', shorts: W, socks: W, ink: '#00529f', badge: '#febe10' },
  bar: { name: 'Barcelona', category: 'internacional', primary: '#a50044', secondary: '#004d98', accent: '#edbb00', pattern: 'stripes', stripes: 7, collar: '#edbb00', sleeves: '#004d98', shorts: '#004d98', socks: '#004d98', ink: '#edbb00', badge: '#edbb00' },

  // temáticas: mesmo cuidado visual para as duas — cor do partido/campanha, emblema no peito, número e nome nas costas
  lul: { name: 'Lula', category: 'tematica', primary: '#c4161c', secondary: W, accent: '#f8d000', pattern: 'star', collar: W, shorts: '#c4161c', socks: W, badge: null, backName: 'LULA', defaultNumber: 13 },
  bol: { name: 'Bolsonaro', category: 'tematica', primary: '#ffdf00', secondary: '#009c3b', accent: '#002776', pattern: 'diamond', collar: '#009c3b', sleeves: '#009c3b', shorts: '#002776', socks: W, ink: '#009c3b', badge: null, backName: 'BOLSONARO', defaultNumber: 22 },

  // originais: clubes fictícios (o boneco padrão de quem não escolheu sai daqui)
  gpl: { name: 'GoPlayers FC', category: 'comunidade', primary: '#7c3aed', secondary: '#ec4899', accent: '#fde047', pattern: 'halves', collar: '#fde047', sleeves: '#7c3aed', shorts: '#1e1b4b', socks: '#ec4899', badge: '#fde047' },
  tub: { name: 'Tubarões do Litoral', category: 'comunidade', primary: '#0e7490', secondary: '#67e8f9', accent: W, pattern: 'chevron', collar: W, shorts: '#164e63', socks: '#0e7490', badge: '#67e8f9' },
  vul: { name: 'Vulcão EC', category: 'comunidade', primary: '#f97316', secondary: '#1c1917', accent: '#fde047', pattern: 'sash', collar: '#1c1917', shorts: '#1c1917', socks: '#f97316', badge: '#fde047' },
  lob: { name: 'Lobos da Serra', category: 'comunidade', primary: '#475569', secondary: '#cbd5e1', accent: '#a3e635', pattern: 'pinstripes', stripes: 12, collar: '#a3e635', shorts: '#1e293b', socks: '#475569', ink: '#a3e635', badge: '#a3e635' },
};

/** Branco ou preto, o que aparecer mais sobre a cor (luminância relativa). */
export function contrastInk(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? K : W;
}

const resolved = new Map<JerseyId, Jersey>();

/** Camisa com os padrões preenchidos (gola, mangas, tinta do número); mesmo objeto a cada chamada. */
export function jersey(id: JerseyId): Jersey {
  let j = resolved.get(id);
  if (!j) {
    const def = JERSEYS[id];
    j = { id, ...def, collar: def.collar ?? def.secondary, sleeves: def.sleeves ?? def.primary, ink: def.ink ?? contrastInk(def.primary) };
    resolved.set(id, j);
  }
  return j;
}

export const ALL_JERSEYS: readonly Jersey[] = JERSEY_IDS.map(jersey);
export const COMMUNITY_JERSEYS: readonly Jersey[] = ALL_JERSEYS.filter((j) => j.category === 'comunidade');

/** Busca sem acento/maiúscula: "gremio" acha Grêmio, "sao" acha São Paulo. */
export function searchJerseys(query: string, category?: JerseyCategory): Jersey[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = fold(query.trim());
  return ALL_JERSEYS.filter((j) => (q ? fold(j.name).includes(q) : j.category === category));
}
