import { act, render, screen } from '@testing-library/react';
import { OfflineBanner } from './offline-banner';

function setOnLine(value: boolean) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);
}

describe('OfflineBanner', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders nothing while online', () => {
    setOnLine(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the offline notice and hides it when the network returns', () => {
    setOnLine(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('Você está offline');
    expect(screen.getByRole('status').className).toContain('fixed'); // não empurra o layout do jogo
    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
