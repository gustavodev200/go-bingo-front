import { INF_BUTTON, INF_COLS, INF_FIX_PANELS, INF_HALLS, INF_ROOMS, INF_ROWS, INF_STATIONS, INF_VENTS, isInfFloor, type InfTaskType } from '@/contracts';

/** Pixels per tile in the pre-rendered map. */
export const TS = 32;

const ROOM_FLOOR: Record<string, [string, string]> = {
  atrio: ['#2a4a63', '#244158'],
  hidro: ['#22503f', '#1d4637'],
  lab: ['#3a4766', '#333f5b'],
  sonar: ['#203f5c', '#1b3651'],
  o2: ['#285a5e', '#224f53'],
  doca: ['#3d4652', '#353d48'],
  eletrica: ['#4b4630', '#423e2a'],
  reator: ['#55352e', '#4a2e28'],
  enfermaria: ['#3c5560', '#354b55'],
};

export const TASK_COLOR: Record<InfTaskType, string> = {
  wires: '#f59e0b',
  dial: '#22d3ee',
  keypad: '#a78bfa',
  fill: '#34d399',
  clean: '#84cc16',
  download: '#60a5fa',
  align: '#f472b6',
  scan: '#2dd4bf',
};

/** Deterministic noise so the map looks the same for everybody. */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const floorAt = (x: number, y: number) => isInfFloor(x, y);

function roomIdAt(x: number, y: number): string | null {
  return INF_ROOMS.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)?.id ?? null;
}

function drawConsole(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const px = x * TS;
  const py = y * TS;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px - 11, py - 9, 22, 18, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(px - 8, py - 6, 16, 8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(px - 7, py + 4, 3, 2);
  ctx.fillRect(px - 2, py + 4, 3, 2);
  ctx.fillRect(px + 3, py + 4, 3, 2);
}

/**
 * Pre-renders the whole Estação Abissal once (floor, walls, consoles, vents,
 * button, labels). The game then only blits the visible part each frame.
 */
export function renderMap(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = INF_COLS * TS;
  cv.height = INF_ROWS * TS;
  const ctx = cv.getContext('2d')!;

  // The ocean outside.
  const sea = ctx.createLinearGradient(0, 0, 0, cv.height);
  sea.addColorStop(0, '#05223a');
  sea.addColorStop(1, '#020b16');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < 260; i++) {
    const x = hash(i, 7) * cv.width;
    const y = hash(i, 13) * cv.height;
    ctx.fillStyle = `rgba(160,220,255,${0.05 + hash(i, 3) * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + hash(i, 5) * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Kelp silhouettes.
  ctx.strokeStyle = 'rgba(20,90,70,0.35)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 40; i++) {
    const x = hash(i, 21) * cv.width;
    const y = hash(i, 23) * cv.height;
    if (floorAt(Math.floor(x / TS), Math.floor(y / TS))) continue;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 1; k < 6; k++) ctx.lineTo(x + Math.sin(k + i) * 8, y - k * 10);
    ctx.stroke();
  }

  // Floors.
  for (let y = 0; y < INF_ROWS; y++)
    for (let x = 0; x < INF_COLS; x++) {
      if (!floorAt(x, y)) continue;
      const room = roomIdAt(x, y);
      if (room) {
        const [a, b] = ROOM_FLOOR[room];
        ctx.fillStyle = (x + y) % 2 ? a : b;
        ctx.fillRect(x * TS, y * TS, TS, TS);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * TS + 0.5, y * TS + 0.5, TS - 1, TS - 1);
      } else {
        // Corridor grating.
        ctx.fillStyle = '#1c2b3a';
        ctx.fillRect(x * TS, y * TS, TS, TS);
        ctx.fillStyle = 'rgba(148,163,184,0.12)';
        for (let k = 4; k < TS; k += 8) ctx.fillRect(x * TS + 2, y * TS + k, TS - 4, 2);
      }
    }

  // Hall stripes at the doors of each room.
  ctx.fillStyle = 'rgba(250,204,21,0.25)';
  for (const h of INF_HALLS) {
    const horizontal = h.w > h.h;
    if (horizontal) {
      ctx.fillRect(h.x * TS, h.y * TS, 4, h.h * TS);
      ctx.fillRect((h.x + h.w) * TS - 4, h.y * TS, 4, h.h * TS);
    } else {
      ctx.fillRect(h.x * TS, h.y * TS, h.w * TS, 4);
      ctx.fillRect(h.x * TS, (h.y + h.h) * TS - 4, h.w * TS, 4);
    }
  }

  // Walls: every solid tile touching the floor. Faces that look down get depth.
  for (let y = 0; y < INF_ROWS; y++)
    for (let x = 0; x < INF_COLS; x++) {
      if (floorAt(x, y)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if (floorAt(x + dx, y + dy)) near = true;
      if (!near) continue;
      const px = x * TS;
      const py = y * TS;
      ctx.fillStyle = '#1b3448';
      ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#28506b';
      ctx.fillRect(px, py, TS, 5);
      if (floorAt(x, y + 1)) {
        // Front face with rivets, and a porthole now and then.
        ctx.fillStyle = '#12263a';
        ctx.fillRect(px, py + TS * 0.45, TS, TS * 0.55);
        ctx.fillStyle = 'rgba(148,163,184,0.5)';
        ctx.fillRect(px + 5, py + TS - 7, 3, 3);
        ctx.fillRect(px + TS - 8, py + TS - 7, 3, 3);
        if (hash(x, y) < 0.18) {
          ctx.fillStyle = '#7dd3fc';
          ctx.strokeStyle = '#b08d3c';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px + TS / 2, py + TS * 0.38, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(px + TS / 2 - 4, py + TS * 0.38 - 4, 3, 3);
        }
      }
      ctx.strokeStyle = 'rgba(2,6,23,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
    }

  // Room flavor.
  const deco = (room: string, fn: (r: { x: number; y: number; w: number; h: number }) => void) => {
    const r = INF_ROOMS.find((q) => q.id === room);
    if (r) fn(r);
  };
  deco('hidro', (r) => {
    for (let i = 0; i < 3; i++) {
      const px = (r.x + 3 + i * 3) * TS;
      const py = (r.y + 4) * TS;
      ctx.fillStyle = '#3f2a1a';
      ctx.fillRect(px, py, TS * 2, TS * 1.4);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 ? '#4ade80' : '#22c55e';
        ctx.beginPath();
        ctx.arc(px + 6 + k * 10, py + 8 + (k % 3) * 9, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  deco('reator', (r) => {
    const cx = (r.x + 5.5) * TS;
    const cy = (r.y + 4.5) * TS;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, TS * 2);
    g.addColorStop(0, '#fde047');
    g.addColorStop(0.4, '#f97316');
    g.addColorStop(1, 'rgba(249,115,22,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, TS * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, TS * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  });
  deco('lab', (r) => {
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect((r.x + 2 + i * 5) * TS, (r.y + 5) * TS, TS * 3, TS * 0.9);
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect((r.x + 2.4 + i * 5) * TS, (r.y + 5.15) * TS, 8, 14);
      ctx.fillStyle = '#34d399';
      ctx.fillRect((r.x + 3.4 + i * 5) * TS, (r.y + 5.15) * TS, 8, 14);
    }
  });
  deco('sonar', (r) => {
    const cx = (r.x + 6) * TS;
    const cy = (r.y + 5) * TS;
    ctx.fillStyle = '#052e16';
    ctx.beginPath();
    ctx.arc(cx, cy, TS * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    for (const k of [0.5, 1, 1.5]) {
      ctx.beginPath();
      ctx.arc(cx, cy, TS * k, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  deco('o2', (r) => {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect((r.x + 2 + i * 2) * TS, (r.y + 3) * TS, TS * 1.1, TS * 2.2, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect((r.x + 2 + i * 2) * TS + 4, (r.y + 3.9) * TS, TS * 1.1 - 8, 8);
    }
  });
  deco('doca', (r) => {
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect((r.x + 4) * TS, (r.y + 2) * TS, TS * 5, TS * 3);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect((r.x + 4) * TS, (r.y + 2) * TS, TS * 5, TS * 3);
    ctx.setLineDash([]);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse((r.x + 6.5) * TS, (r.y + 3.5) * TS, TS * 1.6, TS * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc((r.x + 7.4) * TS, (r.y + 3.3) * TS, 10, 0, Math.PI * 2);
    ctx.fill();
  });
  deco('enfermaria', (r) => {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect((r.x + 3 + i * 3) * TS, (r.y + 1) * TS, TS * 1.6, TS * 2.4);
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect((r.x + 3 + i * 3) * TS, (r.y + 1) * TS, TS * 1.6, TS * 0.6);
    }
    ctx.fillStyle = '#ef4444';
    ctx.fillRect((r.x + 9.6) * TS, (r.y + 5) * TS, 8, 24);
    ctx.fillRect((r.x + 9.6) * TS - 8, (r.y + 5) * TS + 8, 24, 8);
  });
  deco('eletrica', (r) => {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((r.x + 1) * TS, (r.y + 2 + i) * TS);
      ctx.bezierCurveTo((r.x + 4) * TS, (r.y + 3 + i) * TS, (r.x + 6) * TS, (r.y + 1 + i) * TS, (r.x + 9) * TS, (r.y + 2.5 + i) * TS);
      ctx.stroke();
    }
  });
  deco('atrio', () => {
    // The meeting table with the emergency button.
    const cx = INF_BUTTON.x * TS;
    const cy = INF_BUTTON.y * TS;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0b1220';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, TS * 1.5, TS * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 3, TS * 1.35, TS * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Room names.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${TS * 0.6}px system-ui, sans-serif`;
  for (const r of INF_ROOMS) {
    ctx.fillStyle = 'rgba(226,232,240,0.18)';
    ctx.fillText(r.name.toUpperCase(), (r.x + r.w / 2) * TS, (r.y + r.h - 0.9) * TS);
  }

  for (const st of INF_STATIONS) drawConsole(ctx, st.x, st.y, TASK_COLOR[st.type]);
  for (const v of INF_VENTS) {
    const px = v.x * TS;
    const py = v.y * TS;
    ctx.fillStyle = '#0b1220';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(px - 12, py - 9, 24, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#475569';
    for (let k = -6; k <= 6; k += 4) ctx.fillRect(px - 9, py + k - 1, 18, 2);
  }
  for (const [kind, panels] of Object.entries(INF_FIX_PANELS))
    for (const p of panels) {
      const px = p.x * TS;
      const py = p.y * TS;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(px - 10, py - 10, 20, 20);
      ctx.fillStyle = '#111827';
      for (let k = -10; k < 10; k += 6) ctx.fillRect(px + k, py - 10, 3, 20);
      ctx.fillStyle = kind === 'reactor' ? '#38bdf8' : kind === 'oxygen' ? '#22c55e' : '#f8fafc';
      ctx.fillRect(px - 6, py - 6, 12, 12);
    }
  return cv;
}
