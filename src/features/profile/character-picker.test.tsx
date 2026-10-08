import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterPicker } from './character-picker';

vi.mock('next/dynamic', () => ({ default: () => () => null }));

describe('CharacterPicker', () => {
  it('steps forward and back with the arrows, wrapping around the ends', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<CharacterPicker value="c01" onChange={onChange} />);
    expect(screen.getByText('Personagem 1 de 16')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo personagem' }));
    expect(onChange).toHaveBeenLastCalledWith('c02');
    await userEvent.click(screen.getByRole('button', { name: 'Personagem anterior' }));
    expect(onChange).toHaveBeenLastCalledWith('c16');

    rerender(<CharacterPicker value="c16" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Próximo personagem' }));
    expect(onChange).toHaveBeenLastCalledWith('c01');
  });

  it('answers to the keyboard arrows', () => {
    const onChange = vi.fn();
    render(<CharacterPicker value="c03" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Escolha seu personagem' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('c04');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('c02');
  });

  it('shows the nickname over the character (??? while empty)', () => {
    const { rerender } = render(<CharacterPicker value="c01" onChange={vi.fn()} label="Ana" />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    rerender(<CharacterPicker value="c01" onChange={vi.fn()} label="" />);
    expect(screen.getByText('???')).toBeInTheDocument();
  });
});
