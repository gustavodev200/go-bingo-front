import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it.each([
    ['/ABC234', '/ABC234'],
    ['/ranking?x=1', '/ranking?x=1'],
    [null, '/'],
    [undefined, '/'],
    ['', '/'],
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['javascript:alert(1)', '/'],
    // O parser de URL remove tab/CR/LF: "/\t/evil.com" vira "//evil.com".
    ['/\t/evil.com', '/'],
    ['/\n/evil.com', '/'],
    ['/\r\n/evil.com', '/'],
    [decodeURIComponent('/%09/evil.com'), '/'],
    ['/ABC234#x', '/ABC234#x'],
    // Segmentos "."/".." normalizados pelo parser viram "//evil.com" (protocol-relative):
    // router.replace("//evil.com") no NicknameForm sairia do site.
    ['/.//evil.com', '/'],
    ['/..//evil.com', '/'],
    ['/a/..//evil.com', '/'],
    ['/./\\evil.com', '/'],
    ['/%2E//evil.com', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
