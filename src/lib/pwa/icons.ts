export type PwaIcon = { file: string; size: number; maskable: boolean; transparent?: boolean };

export const PWA_ICONS: readonly PwaIcon[] = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  // Favicon da aba: só a bola, sem fundo.
  { file: 'favicon-64.png', size: 64, maskable: false, transparent: true },
];

export function findIcon(file: string): PwaIcon | undefined {
  return PWA_ICONS.find((icon) => icon.file === file);
}
