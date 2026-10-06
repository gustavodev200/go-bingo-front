import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SceneControls } from './scene-controls';

describe('SceneControls', () => {
  it('toggles between 3D and 2D', async () => {
    const onModeChange = vi.fn();
    render(<SceneControls mode="3d" quality="auto" onModeChange={onModeChange} onQualityChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver em 2D' }));
    expect(onModeChange).toHaveBeenCalledWith('2d');
  });

  it('offers the quality override only in 3D', async () => {
    const onQualityChange = vi.fn();
    const { rerender } = render(<SceneControls mode="3d" quality="auto" onModeChange={vi.fn()} onQualityChange={onQualityChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Qualidade 3D'), 'low');
    expect(onQualityChange).toHaveBeenCalledWith('low');
    rerender(<SceneControls mode="2d" quality="auto" onModeChange={vi.fn()} onQualityChange={onQualityChange} />);
    expect(screen.queryByLabelText('Qualidade 3D')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver em 3D' })).toBeInTheDocument();
  });
});
