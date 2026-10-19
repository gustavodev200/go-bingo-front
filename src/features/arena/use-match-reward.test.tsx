import { act, renderHook } from '@testing-library/react';
import type { MatchResultDto } from '@/contracts';
import { useMatchReward } from './use-match-reward';

const apiFetch = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));

const NOW = '2026-10-19T12:00:10.000Z';
const result = (createdAt: string): MatchResultDto => ({
  matchId: '00000000-0000-4000-8000-0000000000aa',
  game: 'UNO',
  placement: 1,
  players: 2,
  won: true,
  abandoned: false,
  pointsDelta: 8,
  coinsDelta: 70,
  staked: 30,
  prize: 60,
  bonuses: [],
  streak: 1,
  points: 108,
  tierUp: null,
  rated: true,
  createdAt,
});

describe('useMatchReward', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiFetch.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('ignores an old result, waits and picks the fresh one (server clock decides)', async () => {
    apiFetch
      .mockResolvedValueOnce({ result: result('2026-10-19T11:50:00.000Z'), now: NOW }) // da partida anterior
      .mockResolvedValueOnce({ result: result('2026-10-19T12:00:09.000Z'), now: NOW });
    const { result: hook } = renderHook(() => useMatchReward());
    expect(hook.current.status).toBe('waiting');

    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(hook.current.status).toBe('waiting');
    await act(() => vi.advanceTimersByTimeAsync(900));

    expect(hook.current.status).toBe('ready');
    expect(hook.current.reward?.pointsDelta).toBe(8);
    expect(apiFetch).toHaveBeenCalledWith('/arena/latest', expect.anything());
  });

  it('gives up after a while when nothing new shows up', async () => {
    apiFetch.mockResolvedValue({ result: null, now: NOW });
    const { result: hook } = renderHook(() => useMatchReward());

    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(hook.current).toEqual({ reward: null, status: 'missing' });
  });

  it('keeps trying through network errors', async () => {
    apiFetch.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ result: result('2026-10-19T12:00:09.000Z'), now: NOW });
    const { result: hook } = renderHook(() => useMatchReward());

    await act(() => vi.advanceTimersByTimeAsync(1_500));

    expect(hook.current.status).toBe('ready');
  });
});
