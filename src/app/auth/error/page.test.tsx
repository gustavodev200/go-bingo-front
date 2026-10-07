import { render, screen } from '@testing-library/react';
import AuthErrorPage from './page';

vi.mock('@/features/auth/upgrade-button', () => ({ SwitchToGoogleAccount: () => null }));

async function renderWith(code?: string) {
  render(await AuthErrorPage({ searchParams: Promise.resolve({ code }) }));
}

describe('AuthErrorPage', () => {
  it('shows the specific message for a known code', async () => {
    await renderWith('exchange_failed');
    expect(screen.getByText(/concluir o login/i)).toBeInTheDocument();
  });

  it('falls back to the generic message for unknown codes and Object.prototype keys', async () => {
    await renderWith('constructor');
    expect(screen.getByText(/entrar com Google\. Tente novamente/i)).toBeInTheDocument();
  });
});
