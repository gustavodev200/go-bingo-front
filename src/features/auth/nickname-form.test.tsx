import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api';
import { NicknameForm } from './nickname-form';

const apiFetch = vi.fn();
const replace = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

describe('NicknameForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prefills the suggestion and saves', async () => {
    apiFetch.mockResolvedValue({ id: 'x', nickname: 'Gustavo', isGuest: false, points: 0 });
    render(<NicknameForm next="/ABC234" suggestion="Gustavo" />);
    expect(screen.getByLabelText(/apelido/i)).toHaveValue('Gustavo');
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(apiFetch).toHaveBeenCalledWith('/me', expect.anything(), { method: 'PATCH', body: JSON.stringify({ nickname: 'Gustavo', character: 'c01' }) });
    expect(replace).toHaveBeenCalledWith('/ABC234');
  });

  it('saves the character chosen with the arrows together with the nickname', async () => {
    apiFetch.mockResolvedValue({});
    render(<NicknameForm next="/" suggestion="Ana" />);
    await userEvent.click(screen.getByRole('button', { name: /anterior/i }));
    expect(screen.getByText('Personagem 16 de 16')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(apiFetch).toHaveBeenCalledWith('/me', expect.anything(), { method: 'PATCH', body: JSON.stringify({ nickname: 'Ana', character: 'c16' }) });
  });

  it('validates locally before calling the API', async () => {
    render(<NicknameForm next="/" suggestion="" />);
    await userEvent.type(screen.getByLabelText(/apelido/i), 'ab');
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/3 a 16/);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('shows the server message', async () => {
    apiFetch.mockRejectedValue(new ApiError(400, 'NICKNAME_INVALID', 'Apelido não permitido'));
    render(<NicknameForm next="/" suggestion="Fulano" />);
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Apelido não permitido');
  });
});
