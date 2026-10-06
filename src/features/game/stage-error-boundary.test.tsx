import { render, screen } from '@testing-library/react';
import { StageErrorBoundary } from './stage-error-boundary';

function Boom(): never {
  throw new Error('ChunkLoadError');
}

describe('StageErrorBoundary', () => {
  it('renders the stage when it works', () => {
    render(
      <StageErrorBoundary onError={vi.fn()}>
        <p>palco</p>
      </StageErrorBoundary>,
    );
    expect(screen.getByText('palco')).toBeInTheDocument();
  });

  it('swallows a crashing 3D stage and reports it, without taking the page down', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onError = vi.fn();
    render(
      <div>
        <StageErrorBoundary onError={onError}>
          <Boom />
        </StageErrorBoundary>
        <p>HUD</p>
      </div>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByText('HUD')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
