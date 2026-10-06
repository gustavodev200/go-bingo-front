import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankingList } from './ranking-list';

const apiFetch = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';

describe('RankingList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows my position, highlights me and loads more pages', async () => {
    apiFetch
      .mockResolvedValueOnce({ entries: [{ rank: 1, userId: ANA, nickname: 'Ana', points: 40 }], me: { rank: 2, points: 20 }, nextCursor: 1 })
      .mockResolvedValueOnce({ entries: [{ rank: 2, userId: ME, nickname: 'Eu', points: 20 }], me: { rank: 2, points: 20 }, nextCursor: null });
    render(<RankingList myUserId={ME} />);
    expect(await screen.findByText('Sua posição: 2º · 20 pts')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/ranking?cursor=0', expect.anything());

    await userEvent.click(screen.getByRole('button', { name: /carregar mais/i }));
    expect(apiFetch).toHaveBeenLastCalledWith('/ranking?cursor=1', expect.anything());
    expect(await screen.findByText('2º Eu')).toBeInTheDocument();
    expect(screen.getByText('2º Eu').closest('li')).toHaveClass('font-semibold');
    expect(screen.queryByRole('button', { name: /carregar mais/i })).not.toBeInTheDocument();
  });

  it('invites guests to sign in with Google', async () => {
    apiFetch.mockResolvedValueOnce({ entries: [], me: null, nextCursor: null });
    render(<RankingList myUserId={ME} />);
    expect(await screen.findByText(/entre com google e jogue/i)).toBeInTheDocument();
  });

  it('shows an error when loading fails', async () => {
    apiFetch.mockRejectedValueOnce(new Error('down'));
    render(<RankingList myUserId={ME} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar o ranking/i);
  });

  it('shows an error when loading more fails', async () => {
    apiFetch.mockResolvedValueOnce({ entries: [], me: null, nextCursor: 1 }).mockRejectedValueOnce(new Error('down'));
    render(<RankingList myUserId={ME} />);
    await userEvent.click(await screen.findByRole('button', { name: /carregar mais/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
