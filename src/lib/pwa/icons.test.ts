import { PWA_ICONS, findIcon } from './icons';

describe('PWA_ICONS', () => {
  it('has 192, 512, a maskable 512 and a transparent favicon', () => {
    expect(PWA_ICONS.map((i) => i.file)).toEqual(['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'favicon-64.png']);
    expect(PWA_ICONS.filter((i) => i.maskable).map((i) => i.file)).toEqual(['icon-maskable-512.png']);
    expect(PWA_ICONS.filter((i) => i.transparent).map((i) => i.file)).toEqual(['favicon-64.png']);
  });

  it('findIcon resolves known files and rejects unknown ones', () => {
    expect(findIcon('icon-192.png')).toMatchObject({ size: 192, maskable: false });
    expect(findIcon('icon-maskable-512.png')).toMatchObject({ size: 512, maskable: true });
    expect(findIcon('../secret.png')).toBeUndefined();
    expect(findIcon('')).toBeUndefined();
  });
});
