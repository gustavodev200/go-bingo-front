import { render, screen } from '@testing-library/react';
import { ConnectionBanner } from './connection-banner';

describe('ConnectionBanner', () => {
  it('renders nothing unless reconnecting', () => {
    const { container } = render(<ConnectionBanner status="online" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('overlays the screen instead of pushing the game layout down', () => {
    render(<ConnectionBanner status="reconnecting" />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Reconectando');
    expect(banner.className).toContain('fixed');
  });
});
