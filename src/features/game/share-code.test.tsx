import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareCode } from './share-code';

const success = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (msg: string) => success(msg) } }));

describe('ShareCode', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  it('uses the native share sheet when available', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    render(<ShareCode code="ABC234" />);
    await userEvent.click(screen.getByRole('button', { name: /compartilhar/i }));
    expect(share).toHaveBeenCalledWith({ title: 'Go Bingo', text: 'Bora jogar bingo! Sala ABC234', url: `${window.location.origin}/ABC234` });
  });

  it('falls back to copying the link', async () => {
    const user = userEvent.setup();
    render(<ShareCode code="ABC234" />);
    await user.click(screen.getByRole('button', { name: /compartilhar/i }));
    await expect(navigator.clipboard.readText()).resolves.toBe(`${window.location.origin}/ABC234`);
    expect(success).toHaveBeenCalledWith('Link da sala copiado!');
  });
});
