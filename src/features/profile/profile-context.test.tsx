import { render, screen } from '@testing-library/react';
import { ApiError } from '@/lib/api';
import { RequireNickname, useProfile } from './profile-context';

const apiFetch = vi.fn();
const replace = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/ABC234' }));

function Name() {
  return <p>{useProfile().profile.nickname}</p>;
}

describe('RequireNickname', () => {
  beforeEach(() => vi.clearAllMocks());

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
