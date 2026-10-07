import { suggestNickname, validateNickname } from './nickname';

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

describe('validateNickname', () => {
  it('trims and accepts a valid nickname', () => {
    expect(validateNickname('  Ana Paula ')).toEqual({ ok: true, value: 'Ana Paula' });
  });
  it('explains the format', () => {
    expect(validateNickname('ab')).toEqual({ ok: false, error: 'Use 3 a 16 letras, números, espaço ou _' });
  });
  it('blocks bad words', () => {
    expect(validateNickname('porra123')).toEqual({ ok: false, error: 'Apelido não permitido' });
  });
});
