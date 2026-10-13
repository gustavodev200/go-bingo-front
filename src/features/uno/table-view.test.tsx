import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unoActions } from '@/test/uno-actions';
import { c, privateHand, roomState, roundView } from '@/test/uno-fixtures';
import { useUnoStore } from './store';
import { TableView } from './table-view';

const audio = { voice: true, setVoice: vi.fn(), sfx: true, setSfx: vi.fn() };

function renderTable(props: Partial<Parameters<typeof TableView>[0]> = {}) {
  const a = unoActions();
  render(<TableView state={roomState()} mySeat={0} hand={privateHand()} actions={a} audio={audio} {...props} />);
  return a;
}

describe('TableView', () => {
  beforeEach(() => useUnoStore.getState().reset());

  it('shows the opponents with their card counts, the top card and my hand', () => {
    renderTable();
    for (const name of ['Bia', 'Caio']) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getAllByLabelText('7 cartas na mão')).toHaveLength(2);
    expect(screen.getByLabelText('Carta da mesa: 5 vermelho')).toBeInTheDocument();
    const hand = screen.getByRole('list', { name: 'Suas cartas' });
    expect(within(hand).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Jogar 3 vermelho' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Jogar 7 azul' })).toBeDisabled();
    expect(screen.getByText('Sua vez!')).toBeInTheDocument();
  });

  it('plays a card and draws on my turn', async () => {
    const a = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Jogar 3 vermelho' }));
    expect(a.playCard).toHaveBeenCalledWith('r1c0', {});
    await userEvent.click(screen.getByRole('button', { name: 'Comprar carta' }));
    expect(a.draw).toHaveBeenCalled();
  });

  it('asks for the color before playing a wild card', async () => {
    const a = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Jogar Coringa' }));
    const dialog = screen.getByRole('dialog', { name: 'Escolha a cor' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Verde' }));
    expect(a.playCard).toHaveBeenCalledWith('r1c2', { color: 'green' });
  });

  it('asks whose hand to take when a 7 swaps hands', async () => {
    const hand = privateHand({ cards: [{ id: 'r1c9', card: c('red', '7') }, ...privateHand().cards], playable: ['r1c9'] });
    const a = renderTable({ hand, state: roomState({ rules: { target: 0, stacking: false, sevenZero: true } }) });
    await userEvent.click(screen.getByRole('button', { name: 'Jogar 7 vermelho' }));
    const dialog = screen.getByRole('dialog', { name: 'Trocar de mão com quem?' });
    await userEvent.click(within(dialog).getByRole('button', { name: /Caio/ }));
    expect(a.playCard).toHaveBeenCalledWith('r1c9', { target: 2 });
  });

  it('offers to keep the drawn card', async () => {
    const a = renderTable({ state: roomState({ round: roundView({ awaitingDrawn: true }) }), hand: privateHand({ drawnCardId: 'r1c0', playable: ['r1c0'] }) });
    await userEvent.click(screen.getByRole('button', { name: 'Passar' }));
    expect(a.pass).toHaveBeenCalled();
  });

  it('lets the +4 victim challenge or take the cards', async () => {
    const a = renderTable({ state: roomState({ round: roundView({ pendingDraw: 4, canChallenge: true, topCard: c('wild', 'wild4'), color: 'blue' }) }), hand: privateHand({ playable: [] }) });
    await userEvent.click(screen.getByRole('button', { name: 'Desafiar' }));
    expect(a.challenge).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Comprar 4' }));
    expect(a.draw).toHaveBeenCalled();
  });

  it('shouts UNO with two cards and catches an exposed opponent', async () => {
    const two = privateHand({ cards: privateHand().cards.slice(0, 2), playable: ['r1c0'] });
    const a = renderTable({ hand: two, state: roomState({ round: roundView({ unoExposed: 1 }) }) });
    await userEvent.click(screen.getByRole('button', { name: 'UNO!' }));
    expect(a.callUno).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Pegar Bia sem UNO' }));
    expect(a.catchUno).toHaveBeenCalled();
  });

  it('shows whose turn it is when it is not mine', () => {
    renderTable({ state: roomState({ round: roundView({ turn: 2 }) }) });
    expect(screen.getByText('Vez de Caio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jogar 3 vermelho' })).toBeDisabled();
  });

  it('shows the final result with a rematch', async () => {
    const a = renderTable({ state: roomState({ phase: 'FINISHED', result: { winner: 1, reason: 'points', scores: [0, 120, 0, 0, 0, 0] } }) });
    expect(screen.getByRole('heading', { name: 'Bia venceu!' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Jogar de novo' }));
    expect(a.rematch).toHaveBeenCalled();
  });
});
