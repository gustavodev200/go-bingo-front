import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SnakeActions } from './connection';
import { SnakeArt } from './snake-art';
import { SnakeScreen } from './snake-screen';
import { useSnakeStore } from './store';

let actions: SnakeActions;
vi.mock('./connection', () => ({ useSnakeArena: () => actions }));
vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({
    profile: {
      id: '00000000-0000-4000-8000-000000000001',
      nickname: 'Ana',
      character: 'c03',
      isGuest: false,
      points: 0,
      coins: 0,
    },
  }),
}));
vi.mock('./media/audio', () => ({
  unlockAudio: vi.fn(),
  sfx: vi.fn(),
  isMuted: () => false,
  toggleMute: () => true,
}));
vi.mock('./media/renderer', () => ({
  SnakeRenderer: vi.fn(),
  drawSkinPreview: vi.fn(),
  drawMinimap: vi.fn(),
}));

const DEATH = { killer: 'Naja', score: 120, kills: 2, rank: 3, secs: 75 };

beforeEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  actions = {
    play: vi.fn().mockResolvedValue(null),
    input: vi.fn(),
    viewSize: vi.fn(),
  };
  useSnakeStore.getState().reset();
  useSnakeStore.getState().joined({ arena: 1, radius: 3000, meta: [] });
});

describe('SnakeScreen', () => {
  it('menu: nickname, skin picker remembered, play with the chosen skin', async () => {
    const user = userEvent.setup();
    render(<SnakeScreen />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText(/conectando à arena/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próxima skin' }));
    await user.click(screen.getByRole('button', { name: 'Próxima skin' }));
    await user.click(screen.getByRole('button', { name: 'Skin anterior' }));
    expect(screen.getByRole('img', { name: 'Skin 2 de 12' })).toBeInTheDocument();
    expect(localStorage.getItem('snake.skin')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Jogar' }));
    expect(actions.play).toHaveBeenCalledWith(1);
  });

  it('shows why it could not play', async () => {
    actions.play = vi.fn().mockResolvedValue('Entre na arena primeiro');
    render(<SnakeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Jogar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Entre na arena primeiro');
  });

  it('cannot play while offline', () => {
    useSnakeStore.getState().setConnection('reconnecting');
    render(<SnakeScreen />);
    expect(screen.getByRole('button', { name: /entrando/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Reconectando');
  });

  it('playing: HUD with leaderboard, my rank, feed and controls', () => {
    useSnakeStore.getState().playing(7);
    useSnakeStore.getState().setLeaderboard({
      top: Array.from({ length: 10 }, (_, i) => ({
        id: i + 100,
        name: `Cobra${i}`,
        score: 500 - i,
      })),
      dots: [[0, 0]],
      total: 20,
      rank: 14,
      me: { score: 40, kills: 3, x: 0, y: 0 },
    });
    useSnakeStore.getState().pushFeed('Cobra0', 'Cobra9');
    render(<SnakeScreen />);
    expect(screen.queryByRole('button', { name: 'Jogar' })).not.toBeInTheDocument();
    const board = screen.getByRole('list', { name: 'Ranking' });
    expect(board).toHaveTextContent('1. Cobra0');
    expect(board).toHaveTextContent('14. Você');
    expect(screen.getByText('14/20')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('eliminou')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sair do jogo' })).toHaveAttribute('href', '/');
    fireEvent.click(screen.getByRole('button', { name: 'Desligar som' }));
    expect(screen.getByRole('button', { name: 'Ligar som' })).toBeInTheDocument();
  });

  it('touch: stick steers and the boost button holds boost', () => {
    useSnakeStore.getState().playing(7);
    render(<SnakeScreen />);
    fireEvent.pointerDown(window, { pointerType: 'touch' });
    const stick = screen.getByLabelText('Analógico');
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(stick, { pointerId: 1, clientX: 150, clientY: 50 });
    fireEvent.pointerMove(stick, { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(stick, { pointerId: 1 });
    const boost = screen.getByRole('button', { name: 'Impulso' });
    fireEvent.pointerDown(boost);
    expect(boost).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerUp(boost);
    expect(boost).toHaveAttribute('aria-pressed', 'false');
  });

  it('death: summary after a moment, new record, play again or back to menu', async () => {
    vi.useFakeTimers();
    useSnakeStore.getState().playing(7);
    render(<SnakeScreen />);
    act(() => useSnakeStore.getState().died(DEATH));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1200));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Eliminado por Naja!');
    expect(dialog).toHaveTextContent('1m 15s');
    expect(dialog).toHaveTextContent('Novo recorde pessoal');
    expect(localStorage.getItem('snake.best')).toBe('120');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Jogar de novo' }));
    });
    expect(actions.play).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeInTheDocument();
    expect(screen.getByText(/recorde 120/)).toBeInTheDocument();
  });

  it('death by the border without beating the record', () => {
    vi.useFakeTimers();
    localStorage.setItem('snake.best', '999');
    render(<SnakeScreen />);
    act(() => useSnakeStore.getState().died({ ...DEATH, killer: null, secs: 9 }));
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByRole('dialog')).toHaveTextContent('Você bateu na borda!');
    expect(screen.getByRole('dialog')).toHaveTextContent('Recorde: 999');
    expect(screen.getByRole('dialog')).toHaveTextContent('9s');
  });

  it('fatal errors leave the arena screen', () => {
    useSnakeStore.getState().setError('Todas as arenas estão cheias');
    render(<SnakeScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent('Todas as arenas estão cheias');
    expect(screen.getByRole('link', { name: /voltar aos jogos/i })).toHaveAttribute('href', '/');
  });

  it('renders the card art', () => {
    const { container } = render(<SnakeArt />);
    expect(container.firstChild).toHaveAttribute('aria-hidden');
  });
});
