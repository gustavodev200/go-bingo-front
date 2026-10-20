import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bjActions } from '@/test/blackjack-actions';
import { gameView, hand, playerView, roomState } from '@/test/blackjack-fixtures';
import { useBjStore } from './store';
import { TableView } from './table-view';

const audio = { voice: true, setVoice: vi.fn(), sfx: true, setSfx: vi.fn() };

function renderTable(props: Partial<Parameters<typeof TableView>[0]> = {}) {
  const a = bjActions();
  render(<TableView state={roomState()} mySeat={0} actions={a} audio={audio} {...props} />);
  return a;
}

describe('TableView', () => {
  beforeEach(() => useBjStore.getState().reset());

  it('shows the dealer with a hidden card, the other player and my hand', () => {
    renderTable();
    const dealer = screen.getByRole('group', { name: /Dealer: 9, uma carta virada/ });
    expect(within(dealer).getByRole('img', { name: 'Carta virada' })).toBeInTheDocument();
    expect(within(dealer).getByRole('img', { name: '9 de copas' })).toBeInTheDocument();
    expect(screen.getByText('Bia')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sua mão: 16' })).toBeInTheDocument();
    expect(screen.getByText('Sua vez!')).toBeInTheDocument();
    expect(screen.getByText('Rodada 1/10 · sapato 96%')).toBeInTheDocument();
  });

  it('plays only the moves the server allows', async () => {
    const a = renderTable();
    await userEvent.click(screen.getByRole('button', { name: /Pedir/ }));
    expect(a.act).toHaveBeenCalledWith('hit');
    expect(screen.getByRole('button', { name: /Dividir/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Dobrar/ }));
    expect(a.act).toHaveBeenCalledWith('double');
  });

  it('hides surrender on a double-deck table', () => {
    renderTable({ state: roomState({ rules: { rounds: 10, payout: '3:2', decks: 2, turnSeconds: 15 }, game: gameView({ actions: ['hit', 'stand'] }) }) });
    expect(screen.queryByRole('button', { name: /Render/ })).not.toBeInTheDocument();
  });

  it('waits on the other player turn', () => {
    renderTable({ state: roomState({ game: gameView({ turn: { seat: 1, hand: 0 } }) }) });
    expect(screen.getByText('Vez de Bia')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pedir/ })).not.toBeInTheDocument();
  });

  it('builds a bet from chips and confirms it', async () => {
    const a = renderTable({
      state: roomState({
        game: gameView({
          stage: 'BETTING',
          turn: null,
          actions: [],
          dealer: { cards: [], total: 0, soft: false, blackjack: false },
          players: [playerView(0, { chips: 1000, bet: null, hands: [] }), playerView(1, { bet: null, hands: [] })],
        }),
      }),
    });
    expect(screen.getByRole('button', { name: /Aposte de 10/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Somar 100' }));
    await userEvent.click(screen.getByRole('button', { name: 'Somar 50' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apostar 150' }));
    expect(a.bet).toHaveBeenCalledWith(150);
    expect(screen.getByText('Apostando…')).toBeInTheDocument();
  });

  it('caps the bet at the table limit', async () => {
    renderTable({
      state: roomState({ game: gameView({ stage: 'BETTING', turn: null, actions: [], players: [playerView(0, { chips: 1000, bet: null, hands: [] }), null] }) }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Somar 500' }));
    expect(screen.getByRole('button', { name: 'Apostar 500' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Somar 10' })).toBeDisabled();
  });

  it('asks about insurance', async () => {
    const a = renderTable({ state: roomState({ game: gameView({ stage: 'INSURANCE', turn: null, actions: [], dealer: { cards: ['AS', null], total: 11, soft: true, blackjack: false } }) }) });
    expect(screen.getByText(/Seguro por 50/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fazer seguro' }));
    expect(a.insurance).toHaveBeenCalledWith(true);
  });

  it('shows split hands and the outcomes after the round', () => {
    renderTable({
      state: roomState({
        game: gameView({
          stage: 'SETTLED',
          turn: null,
          actions: [],
          dealer: { cards: ['9H', '7C', 'KD'], total: 26, soft: false, blackjack: false },
          players: [
            playerView(0, {
              roundNet: 300,
              hands: [
                hand({ cards: ['8S', '3D', '9S'], total: 20, bet: 200, status: 'doubled', split: true, outcome: 'win', net: 200 }),
                hand({ cards: ['8H', 'TC'], total: 18, split: true, status: 'stood', outcome: 'win', net: 100 }),
              ],
            }),
            null,
          ],
        }),
      }),
    });
    expect(screen.getByRole('group', { name: 'Sua mão 1: 20, Ganhou' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sua mão 2: 18, Ganhou' })).toBeInTheDocument();
    expect(screen.getByText('26 estourou')).toBeInTheDocument();
    expect(screen.getByText(/Você ganhou 300 fichas/)).toBeInTheDocument();
  });

  it('shows the final ranking', async () => {
    const a = renderTable({
      state: roomState({
        phase: 'FINISHED',
        result: {
          reason: 'rounds',
          standings: [
            { seat: 1, userId: 'b', nickname: 'Bia', chips: 1400, placement: 1, left: false },
            { seat: 0, userId: 'a', nickname: 'Ana', chips: 800, placement: 2, left: false },
          ],
        },
      }),
    });
    expect(screen.getByRole('heading', { name: 'Bia venceu!' })).toBeInTheDocument();
    const ranking = screen.getByRole('list', { name: 'Classificação' });
    expect(within(ranking).getAllByRole('listitem')[1]).toHaveTextContent('2ºAna (você)800');
    await userEvent.click(screen.getByRole('button', { name: /Jogar de novo/ }));
    expect(a.rematch).toHaveBeenCalled();
  });

  it('ends a solo practice without rewards', () => {
    renderTable({
      state: roomState({
        phase: 'FINISHED',
        seats: [roomState().seats[0], null, null, null, null],
        result: { reason: 'rounds', standings: [{ seat: 0, userId: 'a', nickname: 'Ana', chips: 1250, placement: 1, left: false }] },
      }),
    });
    expect(screen.getByRole('heading', { name: 'Fim do treino' })).toBeInTheDocument();
    expect(screen.getByText('Você terminou com 1.250 fichas.')).toBeInTheDocument();
  });

  it('tells a broke player to watch', () => {
    renderTable({ state: roomState({ game: gameView({ stage: 'BETTING', turn: null, players: [playerView(0, { chips: 0, bet: null, hands: [], broke: true }), playerView(1)] }) }) });
    expect(screen.getByText(/Você ficou sem fichas/)).toBeInTheDocument();
  });
});
