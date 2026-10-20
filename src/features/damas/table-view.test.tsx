import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { damasSquare } from '@/contracts';
import { damasActions } from '@/test/damas-actions';
import { gameView, roomState } from '@/test/damas-fixtures';
import { useDamasStore } from './store';
import { TableView } from './table-view';

const audio = { voice: true, setVoice: vi.fn(), sfx: true, setSfx: vi.fn() };

function renderTable(props: Partial<Parameters<typeof TableView>[0]> = {}) {
  const a = damasActions();
  render(<TableView state={roomState()} mySeat={0} actions={a} audio={audio} {...props} />);
  return a;
}

describe('TableView', () => {
  beforeEach(() => useDamasStore.getState().reset());

  it('shows both players, the board and whose turn it is', () => {
    renderTable();
    expect(screen.getByText('Bia')).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Tabuleiro' })).toBeInTheDocument();
    expect(screen.getByText('Sua vez!')).toBeInTheDocument();
    expect(screen.getAllByText(/Capturou/)).toHaveLength(2);
  });

  it('moves by tapping a piece and then its target', async () => {
    const a = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'c3, pedra branca' }));
    await userEvent.click(screen.getByRole('button', { name: 'd4, mover para cá' }));
    expect(a.move).toHaveBeenCalledWith(damasSquare(5, 2), [damasSquare(4, 3)]);
  });

  it('has no move buttons on the opponent turn', () => {
    renderTable({ state: roomState({ game: gameView({ turn: 'black' }) }) });
    expect(screen.getByText('Vez de Bia')).toBeInTheDocument();
    expect(within(screen.getByRole('grid')).queryAllByRole('button')).toHaveLength(0);
  });

  it('warns about a mandatory capture and preselects the only capturing piece', async () => {
    const capture = { from: damasSquare(5, 2), path: [damasSquare(3, 4)], captures: [damasSquare(4, 3)] };
    const a = renderTable({ state: roomState({ game: gameView({ moves: [capture] }) }) });
    expect(screen.getByText('Captura obrigatória!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'e5, mover para cá' }));
    expect(a.move).toHaveBeenCalledWith(capture.from, capture.path);
  });

  it('answers a draw offer from the opponent', async () => {
    const a = renderTable({ state: roomState({ game: gameView({ drawOffer: 1 }) }) });
    expect(screen.getByText('Bia propõe empate')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
    expect(a.answerDraw).toHaveBeenCalledWith(true);
  });

  it('offers a draw and resigns after confirming', async () => {
    const a = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Propor empate' }));
    expect(a.offerDraw).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Desistir' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desistir' }));
    expect(a.resign).toHaveBeenCalled();
  });

  it('shows the board from the black side for black', () => {
    renderTable({ state: roomState({ game: gameView({ turn: 'black', moves: [] }) }), mySeat: 1 });
    const cells = within(screen.getByRole('grid')).getAllByRole('gridcell');
    expect(cells[0]).toHaveAccessibleName('g1, pedra branca');
  });

  it('shows the result with a rematch', async () => {
    const a = renderTable({ state: roomState({ phase: 'FINISHED', result: { winner: 1, reason: 'resign' } }) });
    expect(screen.getByRole('heading', { name: 'Bia venceu!' })).toBeInTheDocument();
    expect(screen.getByText('Você desistiu.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Revanche/ }));
    expect(a.rematch).toHaveBeenCalled();
  });
});
