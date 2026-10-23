import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterPicker } from './character-picker';

vi.mock('next/dynamic', () => ({ default: () => () => null }));

describe('CharacterPicker', () => {
  it('steps faces with the arrows, keeping jersey and number, wrapping around the ends', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<CharacterPicker value="afla10" onChange={onChange} />);
    expect(screen.getByText(/rosto 1 de 12/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo rosto' }));
    expect(onChange).toHaveBeenLastCalledWith('bfla10');
    await userEvent.click(screen.getByRole('button', { name: 'Rosto anterior' }));
    expect(onChange).toHaveBeenLastCalledWith('lfla10');

    rerender(<CharacterPicker value="lfla10" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Próximo rosto' }));
    expect(onChange).toHaveBeenLastCalledWith('afla10');
  });

  it('answers to the keyboard arrows', () => {
    const onChange = vi.fn();
    render(<CharacterPicker value="cfla10" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Escolha seu personagem' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('dfla10');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('bfla10');
  });

  it('switches jerseys by collection, keeping the number (political ones suggest their own)', async () => {
    const onChange = vi.fn();
    render(<CharacterPicker value="afla10" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Brasileirão 2026' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Flamengo' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Vitória' }));
    expect(onChange).toHaveBeenLastCalledWith('avit10');

    await userEvent.click(screen.getByRole('tab', { name: 'Políticas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lula' }));
    expect(onChange).toHaveBeenLastCalledWith('alul13');
    await userEvent.click(screen.getByRole('button', { name: 'Bolsonaro' }));
    expect(onChange).toHaveBeenLastCalledWith('abol22');
  });

  it('finds jerseys by name across collections', async () => {
    render(<CharacterPicker value="afla10" onChange={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar camisa' }), 'barce');
    expect(screen.getByRole('button', { name: 'Barcelona' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Flamengo' })).not.toBeInTheDocument();
  });

  it('edits the back number and resets to the default player', async () => {
    const onChange = vi.fn();
    render(<CharacterPicker value="dvas07" onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /número nas costas/i }), { target: { value: '99' } });
    expect(onChange).toHaveBeenLastCalledWith('dvas99');
    fireEvent.change(screen.getByRole('spinbutton', { name: /número nas costas/i }), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('dvas00');
    await userEvent.click(screen.getByRole('button', { name: /padrão/i }));
    expect(onChange).toHaveBeenLastCalledWith('agpl10');
  });

  it('toggles front and back view, and shows the nickname over the player (??? while empty)', async () => {
    const { rerender } = render(<CharacterPicker value="afla10" onChange={vi.fn()} label="Ana" />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /ver costas/i }));
    expect(screen.getByRole('button', { name: /ver frente/i })).toBeInTheDocument();
    rerender(<CharacterPicker value="afla10" onChange={vi.fn()} label="" />);
    expect(screen.getByText('???')).toBeInTheDocument();
  });
});
