import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallBanner } from './install-banner';

const state = vi.hoisted(() => ({ mode: 'hidden' as 'hidden' | 'prompt' | 'ios', install: vi.fn(), dismiss: vi.fn() }));
vi.mock('./use-install-prompt', () => ({ useInstallPrompt: () => state }));

describe('InstallBanner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when hidden', () => {
    state.mode = 'hidden';
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a one-tap install on Android', async () => {
    state.mode = 'prompt';
    render(<InstallBanner />);
    await userEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(state.install).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(state.dismiss).toHaveBeenCalled();
  });

  it('explains Share → Add to Home Screen on iOS', async () => {
    state.mode = 'ios';
    render(<InstallBanner />);
    expect(screen.getByText(/Compartilhar/)).toBeInTheDocument();
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(state.dismiss).toHaveBeenCalled();
  });
});
