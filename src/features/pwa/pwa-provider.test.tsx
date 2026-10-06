import { render, screen } from '@testing-library/react';
import { PwaProvider } from './pwa-provider';

const captured = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock('@serwist/turbopack/react', () => ({
  SerwistProvider: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
    captured.props = props;
    return <>{props.children}</>;
  },
}));

describe('PwaProvider', () => {
  it('registers /serwist/sw.js without reloading the page on reconnect or caching navigations', () => {
    render(
      <PwaProvider>
        <p>conteúdo</p>
      </PwaProvider>,
    );
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
    expect(captured.props).toMatchObject({ swUrl: '/serwist/sw.js', reloadOnOnline: false, cacheOnNavigation: false });
  });
});
