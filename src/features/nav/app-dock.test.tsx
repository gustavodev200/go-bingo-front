import { render, screen } from '@testing-library/react';
import { AppDock } from './app-dock';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('AppDock', () => {
  it('links home, create and ranking, marking the current page', () => {
    pathname = '/ranking';
    render(<AppDock />);
    const nav = screen.getByRole('navigation', { name: 'Navegação' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /início/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Criar sala' })).toHaveAttribute('href', '/create');
    expect(screen.getByRole('link', { name: /ranking/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /início/i })).not.toHaveAttribute('aria-current');
  });

  it('stays out of the room screen', () => {
    pathname = '/ABC234';
    render(<AppDock />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('also shows on the profile page', () => {
    pathname = '/perfil';
    render(<AppDock />);
    expect(screen.getByRole('navigation', { name: 'Navegação' })).toBeInTheDocument();
  });
});
