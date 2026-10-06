import manifest from './manifest';

describe('manifest', () => {
  const m = manifest();

  it('is installable standalone in any orientation', () => {
    expect(m).toMatchObject({ name: 'Go Bingo', short_name: 'Go Bingo', start_url: '/', display: 'standalone', orientation: 'any', lang: 'pt-BR', theme_color: '#4c1d95' });
  });

  it('declares 192, 512 and maskable icons', () => {
    const icons = m.icons ?? [];
    expect(icons).toContainEqual(expect.objectContaining({ sizes: '192x192', purpose: 'any' }));
    expect(icons).toContainEqual(expect.objectContaining({ sizes: '512x512', purpose: 'any' }));
    expect(icons).toContainEqual(expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }));
  });
});
