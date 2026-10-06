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
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
