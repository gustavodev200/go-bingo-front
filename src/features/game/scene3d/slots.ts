export type Vec3 = readonly [number, number, number];

export const MAX_SLOTS = 25;
const SPACING = 1.1;
/** Plateia de frente para a câmera; o palco/telão fica atrás (z negativo). Fileiras de trás mais altas. */
const ROWS = [
  { count: 9, z: 1.6, y: 0 },
  { count: 8, z: 0.2, y: 0.4 },
  { count: 8, z: -1.2, y: 0.8 },
] as const;

export const DOOR: Vec3 = [-6.5, 0, 1.6];

function rowXs(count: number): number[] {
  const xs = Array.from({ length: count }, (_, k) => (k - (count - 1) / 2) * SPACING);
  // Do centro para fora, alternando direita/esquerda: o slot 0 (host) fica no meio da frente.
  return xs.sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
}

const SLOT_POSITIONS: Vec3[] = ROWS.flatMap((row) => rowXs(row.count).map((x): Vec3 => [x, row.y, row.z - 0.05 * x * x]));

export function slotPosition(slot: number): Vec3 {
  const index = ((Math.floor(slot) % MAX_SLOTS) + MAX_SLOTS) % MAX_SLOTS;
  return SLOT_POSITIONS[index];
}
