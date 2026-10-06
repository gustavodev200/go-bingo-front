import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SoundToggle } from './sound-toggle';

describe('SoundToggle', () => {
  it('mutes and unmutes', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<SoundToggle muted={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Desligar som' }));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<SoundToggle muted onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Ligar som' })).toHaveAttribute('aria-pressed', 'true');
  });
});
