import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api';
import { RequireNickname, useProfile } from './profile-context';

const apiFetch = vi.fn();
const replace = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));
// Objeto estável, como o router real do Next (senão o effect re-roda a cada render).
vi.mock('next/navigation', () => {
  const router = { replace: (...a: unknown[]) => replace(...a) };
  return { useRouter: () => router, usePathname: () => '/ABC234' };
});

function Name() {
  return <p>{useProfile().profile.nickname}</p>;
}

describe('RequireNickname', () => {
  beforeEach(() => vi.resetAllMocks());

  it('renders children with the profile', async () => {
    apiFetch.mockResolvedValue({ id: 'x', nickname: 'Ana', isGuest: true, points: 0 });
    render(<RequireNickname><Name /></RequireNickname>);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
  });

  it('sends users without nickname to /apelido keeping the path', async () => {
    apiFetch.mockResolvedValue({ id: 'x', nickname: null, isGuest: true, points: 0 });
    render(<RequireNickname><Name /></RequireNickname>);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/apelido?next=%2FABC234'));
  });

  it('sends expired sessions to /login', async () => {
    apiFetch.mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'x'));
    render(<RequireNickname><Name /></RequireNickname>);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2FABC234'));
  });
});

describe('RequireNickname failures', () => {
  beforeEach(() => vi.resetAllMocks());

  it('offers a retry when the API is down', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(0, 'INTERNAL', 'Sem conexão com o servidor'));
    apiFetch.mockResolvedValueOnce({ id: 'x', nickname: 'Ana', isGuest: true, points: 0 });
    render(<RequireNickname><Name /></RequireNickname>);
    await userEvent.click(await screen.findByRole('button', { name: /tentar de novo/i }));
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('useProfile outside the guard throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Name />)).toThrow(/fora de <RequireNickname>/);
  });
});
