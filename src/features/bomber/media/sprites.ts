// Procedural pixel-art sprites (16 px tiles, SNES palette). No image files.
import { BOMBER_COLORS, type BomberFlameKind } from '@/contracts';

export const TS = 16;

type Sprite = HTMLCanvasElement;

function canvas(w: number, h: number): Sprite {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: Sprite): CanvasRenderingContext2D {
  return c.getContext('2d')!;
}

function paint(rows: readonly string[], pal: Record<string, string>, w = 16): Sprite {
  const c = canvas(w, rows.length);
  const g = ctx2d(c);
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const col = pal[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

const mirrorRow = (r: string) => r.padEnd(16, '.').slice(0, 16).split('').reverse().join('');
const mirrorAll = (rows: string[]) => rows.map(mirrorRow);

// ---------- Bomberman ----------
const ANT = ['.......kk.......', '......kppk......', '......kpqk......', '.......kk.......'];
const HEAD_DOWN = ['....kkkkkkkk....', '...kHHHHHHwwk...', '..kHHHHHHHHHwk..', '..kHHkkkkkkHHk..', '..kHkffffffkHk..', '..kHkfeffefkHk..', '..kHkfeffefkHk..', '..khkffffffkhk..', '...khkkkkkkhk...'];
const HEAD_UP = ['....kkkkkkkk....', '...kHHHHHHHHk...', '..kHHHHHHHHHHk..', '..kHHHHHHHHHHk..', '..kHHHHHHHHHHk..', '..kHHHHHHHHHHk..', '..khHHHHHHHHhk..', '..khhHHHHHHhhk..', '...kkkkkkkkkk...'];
const HEAD_LEFT = ['....kkkkkkkk....', '...kHHHHHHwwk...', '..kHHHHHHHHHwk..', '..kkkkkkHHHHHk..', '..kffffkHHHHHk..', '..kfeffkHHHHHk..', '..kfeffkHHHHHk..', '..kffffkhHHHhk..', '...kkkkkkhhhk...'];
const BODY_FRONT = ['....kkkbbkkk....', '...kpkbbbbkpk...', '...kpkyyyykpk...', '....kkbbbbkk....'];
const BODY_BACK = ['....kkkbbkkk....', '...kpkbbbbkpk...', '...kpkbbbbkpk...', '....kkbbbbkk....'];
const BODY_LEFT = ['.....kkbbbkk....', '.....kpbbbbk....', '.....kpyyybk....', '.....kkbbbkk....'];
const LEGS_FRONT = [
  ['....kbbkkbbk....', '...kpppkkpppk...', '...kkkkkkkkkk...'],
  ['...kbbk.kbbk....', '..kpppk..kpk....', '..kkkkk..kk.....'],
];
const LEGS_SIDE = [
  ['.....kbbbbk.....', '....kpppkpk.....', '....kkkkkkk.....'],
  ['....kbbkkbbk....', '...kppk..kppk...', '...kkk....kkk...'],
  ['.....kbbbbk.....', '.....kpppk......', '.....kkkkk......'],
];

/** frames[dir][frame]: dir 1 up, 2 down, 3 left, 4 right; frame 0 stand, 1..3 walk. */
export type BomberFrames = Sprite[][];

function buildBomber(color: (typeof BOMBER_COLORS)[number]): BomberFrames {
  const pal = { k: color.outline, H: color.helmet, h: color.shade, w: '#ffffff', f: '#f8c8a0', e: '#101010', p: '#f850a8', q: '#b02870', b: color.body, y: '#f8c020' };
  const front = (legs: string[]) => [...ANT, ...HEAD_DOWN, ...BODY_FRONT, ...legs];
  const back = (legs: string[]) => [...ANT, ...HEAD_UP, ...BODY_BACK, ...legs];
  const side = (legs: string[]) => [...ANT.map((r) => r.slice(1) + '.'), ...HEAD_LEFT, ...BODY_LEFT, ...legs];
  const walkF = [LEGS_FRONT[0], LEGS_FRONT[1], LEGS_FRONT[0], LEGS_FRONT[1].map(mirrorRow)];
  const walkS = [LEGS_SIDE[0], LEGS_SIDE[1], LEGS_SIDE[2], LEGS_SIDE[1]];
  return [[], walkF.map((l) => paint(back(l), pal)), walkF.map((l) => paint(front(l), pal)), walkS.map((l) => paint(side(l), pal)), walkS.map((l) => paint(mirrorAll(side(l)), pal))];
}

// ---------- Tiles ----------
function hardBlock(): Sprite {
  const c = canvas(16, 16);
  const g = ctx2d(c);
  g.fillStyle = '#58586a';
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#b4b4c4';
  g.fillRect(1, 1, 14, 14);
  g.fillStyle = '#e8e8f4';
  g.fillRect(1, 1, 14, 2);
  g.fillRect(1, 1, 2, 14);
  g.fillStyle = '#7c7c90';
  g.fillRect(1, 13, 14, 2);
  g.fillRect(13, 1, 2, 14);
  g.fillStyle = '#c8c8d8';
  g.fillRect(4, 4, 8, 8);
  return c;
}

function softBlock(tint: string | null = null): Sprite {
  const c = canvas(16, 16);
  const g = ctx2d(c);
  g.fillStyle = tint ?? '#9898a8';
  g.fillRect(0, 0, 16, 16);
  const light = tint ? '#ffd080' : '#d0d0dc';
  const dark = tint ? '#a04010' : '#606070';
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const off = row % 2 ? 4 : 0;
    g.fillStyle = dark;
    g.fillRect(0, y + 3, 16, 1);
    for (let x = -8 + off; x < 16; x += 8) {
      g.fillStyle = dark;
      g.fillRect(x + 7, y, 1, 3);
      g.fillStyle = light;
      g.fillRect(x, y, 7, 1);
    }
  }
  return c;
}

function floorTile(shadow: boolean): Sprite {
  const c = canvas(16, 16);
  const g = ctx2d(c);
  g.fillStyle = '#2f9a3c';
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#35a643';
  g.fillRect(1, 1, 7, 7);
  g.fillRect(9, 9, 6, 6);
  if (shadow) {
    g.fillStyle = '#1f7a2c';
    g.fillRect(0, 0, 16, 4);
  }
  return c;
}

// ---------- Bomb ----------
const BOMB_ROWS = ['................', '................', '..........k.....', '.........k......', '.....kkkkk......', '...kkKKKKKkk....', '..kKKKKKKKKKk...', '..kKwwKKKKKKk...', '.kKwwKKKKKKKKk..', '.kKwKKKKKKKKKk..', '.kKKKKKKKKKKKk..', '.kKKKKKKKKKKKk..', '..kKKKKKKKKKk...', '..kKKKKKKKKKk...', '...kkKKKKKkk....', '.....kkkkk......'];

// ---------- Items ----------
const FIRE_ICON = ['.....r......', '....rr...r..', '...rorr..rr.', '..rroorr.rr.', '..roooorrrr.', '.rrooyyoorr.', '.rooyyyyoor.', '.royywwyyor.', '.royywwyyor.', '.rooyyyyoor.', '..rrooooorr.', '....rrrrr...'];
const ICONS: Record<string, string[]> = {
  B: ['........yy..', '.......k.y..', '......k.....', '...kkkk.....', '..kKKKKk....', '.kKwKKKKk...', '.kKwKKKKk...', '.kKKKKKKk...', '.kKKKKKKk...', '..kKKKKk....', '...kkkk.....', '............'],
  F: FIRE_ICON,
  M: FIRE_ICON,
  S: ['............', '...kkkk.....', '...kbbk.....', '...kbbk.....', '...kbbkkk...', '...kbbbbbk..', '..kbbbbbbbk.', '..kwwwwwwwk.', '..kkkkkkkkk.', '...kk...kk..', '..kggk.kggk.', '...kk...kk..'],
  K: ['............', '....kkkk....', '....knnk....', '....knnk....', '....knnk....', '....knnkkk..', '...knnnnnnk.', '..knnnnnnnnk', '..kwwwwwwwwk', '..kkkkkkkkkk', '............', '............'],
  G: ['............', '...k.k.k....', '..kpkpkpk...', '..kpkpkpkk..', '..kpppppkpk.', '..kppppppk..', '..kppppppk..', '...kppppk...', '...kwwwwk...', '...kkkkkk...', '............', '............'],
  X: ['............', '...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkkwwkkwk.', '.kwwwkkwwwk.', '..kwwwwwwk..', '...kwkwkk...', '...kwwwwk...', '....kkkk....', '............'],
  R: ['....k.......', '....k.......', '...kkkk.....', '..kggggk....', '..kgrrgk....', '..kgrrgk....', '..kggggk....', '..kgyygk....', '..kggggk....', '..kkkkkk....', '............', '............'],
};
const ICON_PAL = { k: '#101018', K: '#283050', w: '#ffffff', y: '#f8e040', r: '#e02818', o: '#f88818', b: '#3870f8', g: '#a0a0b0', n: '#a05820', p: '#f8a050' };
export const ITEM_BG: Record<string, string> = { B: '#2850c8', F: '#d03020', M: '#e8a010', S: '#18a0a0', K: '#8040c0', G: '#e07018', X: '#b01818', R: '#28a048' };

function itemSprite(ch: string): Sprite {
  const c = canvas(16, 16);
  const g = ctx2d(c);
  g.fillStyle = '#101018';
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = ITEM_BG[ch];
  g.fillRect(1, 1, 14, 14);
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fillRect(1, 1, 14, 2);
  g.fillRect(1, 1, 2, 14);
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.fillRect(1, 13, 14, 2);
  g.fillRect(13, 1, 2, 14);
  g.drawImage(paint(ICONS[ch], ICON_PAL, 12), 2, 2);
  if (ch === 'M') {
    g.fillStyle = '#fff';
    g.fillRect(9, 10, 6, 5);
    g.fillStyle = '#d03020';
    g.font = 'bold 5px monospace';
    g.fillText('M', 10, 14.5);
  }
  return c;
}

export interface Sprites {
  hard: Sprite;
  soft: Sprite;
  burning: Sprite;
  floor: Sprite;
  floorShadow: Sprite;
  bomb: Sprite;
  bombRemote: Sprite;
  items: Record<string, Sprite>;
  bombers: BomberFrames[];
}

let cached: Sprites | null = null;

/** Built once per page (they never change). */
export function sprites(): Sprites {
  cached ??= {
    hard: hardBlock(),
    soft: softBlock(),
    burning: softBlock('#e06020'),
    floor: floorTile(false),
    floorShadow: floorTile(true),
    bomb: paint(BOMB_ROWS, { k: '#000', K: '#283050', w: '#c8d0ff' }),
    bombRemote: paint(BOMB_ROWS, { k: '#000', K: '#5a1830', w: '#c8d0ff' }),
    items: Object.fromEntries(Object.keys(ICONS).map((ch) => [ch, itemSprite(ch)])),
    bombers: BOMBER_COLORS.map(buildBomber),
  };
  return cached;
}

/** One flame tile; `life` goes 1 → 0. */
export function drawFlame(g: CanvasRenderingContext2D, x: number, y: number, kind: BomberFlameKind, life: number, t: number): void {
  const grow = life > 0.82 ? (1 - life) / 0.18 : Math.min(1, life / 0.6);
  const s = 0.35 + 0.65 * grow;
  const flick = Math.sin(t * 40 + x * 3 + y * 7) * 0.6;
  const layers: [string, number][] = [
    ['#e83010', 14 * s + flick],
    ['#f8a020', 10 * s],
    ['#f8f070', 6 * s],
    ['#ffffff', 2.5 * s],
  ];
  const cx = x + 8;
  const cy = y + 8;
  const cap = (px: number, py: number, r: number) => {
    g.beginPath();
    g.arc(px, py, r, 0, Math.PI * 2);
    g.fill();
  };
  for (const [col, w] of layers) {
    if (w <= 0.5) continue;
    g.fillStyle = col;
    const h = w / 2;
    if (kind === 'h' || kind === 'c') g.fillRect(x, cy - h, 16, w);
    if (kind === 'v' || kind === 'c') g.fillRect(cx - h, y, w, 16);
    if (kind === 'c') cap(cx, cy, h + 1.5);
    if (kind === 'l') {
      g.fillRect(x + 3, cy - h, 13, w);
      cap(x + 3 + h * 0.4, cy, h);
    }
    if (kind === 'r') {
      g.fillRect(x, cy - h, 13, w);
      cap(x + 13 - h * 0.4, cy, h);
    }
    if (kind === 'u') {
      g.fillRect(cx - h, y + 3, w, 13);
      cap(cx, y + 3 + h * 0.4, h);
    }
    if (kind === 'd') {
      g.fillRect(cx - h, y, w, 13);
      cap(cx, y + 13 - h * 0.4, h);
    }
  }
}

/** Big idle bomber for lobby cards; scales to the canvas with crisp pixels. */
export function drawPortrait(cv: HTMLCanvasElement, color: number, t: number): void {
  const g = cv.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  const frames = sprites().bombers[color] ?? sprites().bombers[0];
  const s = Math.floor(Math.min(cv.width / 16, cv.height / 21));
  const x = Math.floor((cv.width - 16 * s) / 2);
  const y = Math.floor((cv.height - 20 * s) / 2) + (Math.floor(t * 3) % 2) * s;
  g.drawImage(frames[2][0], x, y, 16 * s, 20 * s);
}
