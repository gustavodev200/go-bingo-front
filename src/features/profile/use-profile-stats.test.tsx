import { act, renderHook, waitFor } from '@testing-library/react';
import { useProfileStats } from './use-profile-stats';

const apiFetch = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));

const stats = { gamesPlayed: 1, wins: 0, points: 0, rank: null, coinHistory: [] };

describe('useProfileStats', () => {
  beforeEach(() => apiFetch.mockReset());

  it('loads /me/stats', async () => {
    apiFetch.mockResolvedValue(stats);
    const { result } = renderHook(() => useProfileStats());
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('ok'));
    expect(result.current.stats).toEqual(stats);
    expect(apiFetch).toHaveBeenCalledWith('/me/stats', expect.anything());
  });

  it('reports errors and reloads on demand', async () => {
    apiFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(stats);
    const { result } = renderHook(() => useProfileStats());
    await waitFor(() => expect(result.current.state).toBe('error'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.state).toBe('ok'));
  });
});
