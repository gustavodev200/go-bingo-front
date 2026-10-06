export type PwaIcon = { file: string; size: number; maskable: boolean };

export const PWA_ICONS: readonly PwaIcon[] = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
];

export function findIcon(file: string): PwaIcon | undefined {
  return PWA_ICONS.find((icon) => icon.file === file);
}
