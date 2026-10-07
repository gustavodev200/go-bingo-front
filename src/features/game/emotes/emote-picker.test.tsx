import { act, fireEvent, render, screen } from '@testing-library/react';
import { EMOTE_COOLDOWN_MS, EmotePicker } from './emote-picker';

describe('EmotePicker', () => {
  afterEach(() => vi.useRealTimers());

  it('opens the four emotes, sends one, closes and cools down', () => {
    vi.useFakeTimers();
    const onEmote = vi.fn();
    render(<EmotePicker onEmote={onEmote} />);
    const toggle = screen.getByRole('button', { name: 'Reagir' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    for (const label of ['Aplausos', 'Susto', 'Risada', 'Pegando fogo']) expect(screen.getByRole('button', { name: label })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aplausos' }));
    expect(onEmote).toHaveBeenCalledWith('clap');
    expect(screen.queryByRole('button', { name: 'Aplausos' })).not.toBeInTheDocument();
    expect(toggle).toBeDisabled();

    act(() => vi.advanceTimersByTime(EMOTE_COOLDOWN_MS));
    expect(toggle).toBeEnabled();
  });

  it('closes with Escape', () => {
    render(<EmotePicker onEmote={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reagir' }));
    fireEvent.keyDown(screen.getByRole('group', { name: 'Reações' }), { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Reações' })).not.toBeInTheDocument();
  });
});
