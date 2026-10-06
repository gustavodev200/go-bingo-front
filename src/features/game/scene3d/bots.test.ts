import { BOT_ID_PREFIX, botMembers, botName, parseBots } from './bots';

describe('parseBots', () => {
  it('reads ?bots=N only when enabled, clamped to 1..25', () => {
    expect(parseBots('?bots=25', true)).toBe(25);
    expect(parseBots('?bots=99', true)).toBe(25);
    expect(parseBots('?bots=0', true)).toBe(0);
    expect(parseBots('?bots=abc', true)).toBe(0);
    expect(parseBots('', true)).toBe(0);
    expect(parseBots('?bots=25', false)).toBe(0);
  });
});

describe('botMembers', () => {
  it('fills free slots with deterministic fake members', () => {
    const bots = botMembers(3, [0, 2]);
    expect(bots.map((b) => b.slot)).toEqual([1, 3, 4]);
    expect(bots.every((b) => b.userId.startsWith(BOT_ID_PREFIX) && b.connected && b.hasCard)).toBe(true);
    expect(botMembers(3, [0, 2])).toEqual(bots);
  });

  it('never exceeds the free slots', () => {
    expect(botMembers(30, [0])).toHaveLength(24);
  });
});

describe('botName', () => {
  it('names bots and ignores real ids', () => {
    expect(botName(botMembers(1, [])[0].userId)).toBe('Bot 1');
    expect(botName('00000000-0000-4000-8000-000000000001')).toBeNull();
  });
});
