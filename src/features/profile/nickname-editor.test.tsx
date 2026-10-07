import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api';
import { NicknameEditor } from './nickname-editor';

const apiFetch = vi.fn();
const toastSuccess = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m) } }));

describe('NicknameEditor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the nickname and saves a new one', async () => {
    const onSaved = vi.fn().mockResolvedValue(undefined);
    apiFetch.mockResolvedValue({});
    render(<NicknameEditor nickname="Ana" onSaved={onSaved} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Editar apelido' }));
    const input = screen.getByLabelText('Apelido');
    await userEvent.clear(input);
    await userEvent.type(input, '  Aninha  ');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(apiFetch).toHaveBeenCalledWith('/me', expect.anything(), { method: 'PATCH', body: JSON.stringify({ nickname: 'Aninha' }) });
    expect(onSaved).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith('Apelido atualizado!');
    expect(screen.queryByLabelText('Apelido')).not.toBeInTheDocument();
  });

  it('validates locally before calling the server', async () => {
    render(<NicknameEditor nickname="Ana" onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar apelido' }));
    await userEvent.clear(screen.getByLabelText('Apelido'));
    await userEvent.type(screen.getByLabelText('Apelido'), 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/3 a 16/);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('shows the server error and keeps editing', async () => {
    apiFetch.mockRejectedValue(new ApiError(400, 'NICKNAME_INVALID', 'Apelido não permitido'));
    render(<NicknameEditor nickname="Ana" onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar apelido' }));
    await userEvent.type(screen.getByLabelText('Apelido'), 'zz');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Apelido não permitido');
    expect(screen.getByLabelText('Apelido')).toBeInTheDocument();
  });

  it('cancel restores the current nickname without saving', async () => {
    render(<NicknameEditor nickname="Ana" onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar apelido' }));
    await userEvent.type(screen.getByLabelText('Apelido'), 'xyz');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Ana')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Editar apelido' }));
    expect(screen.getByLabelText('Apelido')).toHaveValue('Ana');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('saving the same nickname just closes the editor', async () => {
    render(<NicknameEditor nickname="Ana" onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar apelido' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Apelido')).not.toBeInTheDocument();
  });
});
