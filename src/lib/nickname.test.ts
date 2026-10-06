import { suggestNickname } from './nickname';

describe('suggestNickname', () => {
  it('uses the first name', () => {
    expect(suggestNickname('Gustavo Lage')).toBe('Gustavo');
  });

  it('strips unsupported characters and truncates to 16', () => {
    expect(suggestNickname("D'Ávila-Superlongnamehere")).toBe('DÁvilaSuperlongn');
  });

  it('returns empty when nothing valid remains', () => {
    expect(suggestNickname(undefined)).toBe('');
    expect(suggestNickname('李')).toBe('');
    expect(suggestNickname('Jo')).toBe('');
  });
});
