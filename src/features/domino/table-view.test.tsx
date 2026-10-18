import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dominoActions } from '@/test/domino-actions';
import { privateHand, roomState, roundView, seatPlayer } from '@/test/domino-fixtures';
import { useDominoStore } from './store';
import { TableView } from './table-view';

const audio = { voice: true, setVoice: vi.fn(), sfx: true, setSfx: vi.fn() };

function renderTable(props: Partial<Parameters<typeof TableView>[0]> = {}) {
  const a = dominoActions();
  render(<TableView state={roomState()} mySeat={0} hand={privateHand()} actions={a} audio={audio} {...props} />);
  return a;
}

describe('TableView', () => {
  beforeEach(() => useDominoStore.getState().reset());

  it('shows the opponents with their tiles, the line, the boneyard and my hand', () => {
    renderTable();
    for (const name of ['Bia', 'Caio']) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getAllByLabelText('6 peças na mão')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Mesa com 3 peças; pontas 1 e 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Monte com 7 peças')).toBeInTheDocument();
    const hand = screen.getByRole('list', { name: 'Suas peças' });
    expect(within(hand).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Jogar 2 e 4' })).toBeDisabled();
    expect(screen.getByText('Sua vez!')).toBeInTheDocument();
  });

  it('plays a tile that fits one end right away', async () => {
    const a = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Jogar 3 e 5' }));
    expect(a.play).toHaveBeenCalledWith('r1t1', 'right');
  });

  it('asks which end when the tile fits both', async () => {
    const a = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Jogar 1 e 3' }));
    expect(a.play).not.toHaveBeenCalled();
    expect(screen.getByText('Toque em uma ponta brilhando')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Ponta 1/ }));
    expect(a.play).toHaveBeenCalledWith('r1t0', 'left');
  });

  it('offers to buy when nothing fits', async () => {
    const a = renderTable({ hand: privateHand({ playable: [], mustDraw: true }) });
    expect(screen.getByText('Nenhuma peça serve: compre do monte')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Comprar do monte' }));
    expect(a.draw).toHaveBeenCalled();
  });

  it('shows whose turn it is and the round summary between rounds', () => {
    const { rerender } = render(<TableView state={roomState({ round: roundView({ turn: 1 }) })} mySeat={0} hand={privateHand()} actions={dominoActions()} audio={audio} />);
    expect(screen.getByText('Vez de Bia')).toBeInTheDocument();
    rerender(
      <TableView
        state={roomState({ round: roundView({ phase: 'ROUND_OVER', lastRound: { winners: [1], points: 12, blocked: true, pips: [12, 3, 9, 0] } }) })}
        mySeat={0}
        hand={privateHand()}
        actions={dominoActions()}
        audio={audio}
      />,
    );
    expect(screen.getByText('Bia venceu a rodada!')).toBeInTheDocument();
    expect(screen.getByText(/Jogo trancado: menor mão, \+12 pontos/)).toBeInTheDocument();
  });

  it('marks teams in 2 against 2 and shows the result panel at the end', async () => {
    const seats = [0, 1, 2, 3].map((s) => seatPlayer(s));
    const a = renderTable({
      state: roomState({ seats, rules: { target: 50, teams: true }, phase: 'FINISHED', result: { winners: [0, 2], reason: 'points', scores: [52, 10, 52, 10] } }),
    });
    expect(screen.getByRole('heading', { name: 'Sua dupla venceu!' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Jogar de novo/ }));
    expect(a.rematch).toHaveBeenCalled();
  });
});
