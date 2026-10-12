import { DEFAULT_CONVENTIONS, loadConventions, saveConventions } from './signals';

describe('signal conventions', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to the classic meanings', () => {
    expect(loadConventions()).toEqual(DEFAULT_CONVENTIONS);
    expect(DEFAULT_CONVENTIONS.wink).toMatch(/Zap/);
  });

  it('saves and loads the pair conventions, ignoring unknown values', () => {
    saveConventions({ ...DEFAULT_CONVENTIONS, wink: 'Mão fraca' });
    expect(loadConventions().wink).toBe('Mão fraca');
    localStorage.setItem('truco:signals', JSON.stringify({ wink: 'hack', nose: 'Estou blefando' }));
    expect(loadConventions()).toMatchObject({ wink: DEFAULT_CONVENTIONS.wink, nose: 'Estou blefando' });
    localStorage.setItem('truco:signals', '{broken');
    expect(loadConventions()).toEqual(DEFAULT_CONVENTIONS);
  });
});
