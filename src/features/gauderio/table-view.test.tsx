import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { gaudActions, handActions, matchView, privateHand, roomState, seatPlayer } from '@/test/gauderio-fixtures';
import { useGaudStore } from './store';
import { TableView } from './table-view';

vi.mock('@/features/arena/reward-panel', () => ({ MatchRewardPanel: () => null }));

const audio = { voice: true, setVoice: vi.fn(), sfx: true, setSfx: vi.fn() };

function renderTable(props: Partial<Parameters<typeof TableView>[0]> = {}) {
  const a = gaudActions();
  render(<TableView state={roomState()} mySeat={0} hand={privateHand()} actions={a} audio={audio} {...props} />);
  return a;
}

describe('TableView (Truco Gaudério)', () => {
  beforeEach(() => useGaudStore.getState().reset());

  it('mostra o placar do meu lado, o adversário, minhas cartas e meu envido', () => {
    renderTable({ state: roomState({ scores: [4, 8] }) });
    expect(screen.getByLabelText('Você: 4 pontos')).toBeInTheDocument();
    expect(screen.getByLabelText('Eles: 8 pontos')).toBeInTheDocument();
    expect(screen.getByText('Bia')).toBeInTheDocument();
    const hand = screen.getByRole('list', { name: 'Suas cartas' });
    expect(within(hand).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Jogar Ás de espadas (Espadão)' })).toBeEnabled();
    expect(screen.getByText(/Envido: 33/)).toHaveTextContent('Envido: 33= 20 + 7 + 6');
    expect(screen.getByText('Sua vez!')).toBeInTheDocument();
  });

  it('joga carta, canta e vai ao baralho', async () => {
    const a = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Jogar 7 de copas' }));
    expect(a.playCard).toHaveBeenCalledWith('h1s0c1', false);
    await userEvent.click(screen.getByRole('button', { name: 'Truco!' }));
    expect(a.call).toHaveBeenCalledWith('truco');
    await userEvent.click(screen.getByRole('button', { name: 'Real Envido!' }));
    expect(a.call).toHaveBeenCalledWith('real_envido');
    await userEvent.click(screen.getByRole('button', { name: 'Ir ao baralho' }));
    expect(a.fold).toHaveBeenCalled();
  });

  it('esconde a carta da segunda rodada em diante', async () => {
    const a = renderTable({ hand: privateHand({ actions: handActions({ canHide: true }) }) });
    await userEvent.click(screen.getByText('Esconder carta'));
    await userEvent.click(screen.getByRole('button', { name: 'Esconder 6 de copas' }));
    expect(a.playCard).toHaveBeenCalledWith('h1s0c2', true);
  });

  it('responde ao canto do adversário com quero, não quero ou aumento', async () => {
    const state = roomState({ match: matchView({ turn: 1, phase: 'AWAITING_RESPONSE', pending: { kind: 'truco', call: 'truco', chain: ['truco'], seat: 1, team: 1, votes: 0 } }) });
    const a = renderTable({ state, hand: privateHand({ actions: handActions({ canPlay: false, canFold: false, calls: ['retruco', 'envido'], canAccept: true, canDecline: true }) }) });
    const group = screen.getByRole('group', { name: 'Responder canto' });
    expect(within(group).getByText(/Cantaram Truco/)).toBeInTheDocument();
    await userEvent.click(within(group).getByRole('button', { name: 'Quero' }));
    expect(a.respond).toHaveBeenCalledWith(true);
    await userEvent.click(within(group).getByRole('button', { name: 'Não quero' }));
    expect(a.respond).toHaveBeenCalledWith(false);
    await userEvent.click(within(group).getByRole('button', { name: 'Retruco!' }));
    expect(a.call).toHaveBeenCalledWith('retruco');
    expect(screen.getByText('Truco')).toBeInTheDocument();
  });

  it('avisa da flor e espera quando a resposta é dos outros', () => {
    const state = roomState({ match: matchView({ phase: 'AWAITING_RESPONSE', pending: { kind: 'envido', call: 'envido', chain: ['envido'], seat: 0, team: 0, votes: 0 } }) });
    renderTable({ state, hand: privateHand({ actions: handActions({ canPlay: false, canFold: false, calls: [] }) }) });
    expect(screen.getByText('Esperando a resposta ao Envido…')).toBeInTheDocument();
  });

  it('a flor é opcional: dá para jogar a carta ou cantar', () => {
    renderTable({ hand: privateHand({ flor: true, actions: handActions({ calls: ['truco', 'envido', 'flor'] }) }) });
    expect(screen.getByRole('button', { name: 'Flor!' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jogar Ás de espadas (Espadão)' })).toBeEnabled();
    expect(screen.getByText(/Cantar é opcional/)).toBeInTheDocument();
  });

  it('em duplas a resposta é votada e mostra o voto do parceiro', async () => {
    const seats = [0, 1, 2, 3].map((s) => seatPlayer(s as 0 | 1 | 2 | 3));
    const match = matchView({ turn: 1, cardsLeft: [3, 3, 3, 3], phase: 'AWAITING_RESPONSE', pending: { kind: 'truco', call: 'truco', chain: ['truco'], seat: 1, team: 1, votes: 1 } });
    const a = renderTable({
      state: roomState({ settings: { size: 4, target: 12, flor: true }, seats, match }),
      hand: privateHand({ votes: { mine: 'accept', partner: 'retruco' }, actions: handActions({ canPlay: false, canFold: false, calls: ['retruco'], canAccept: true, canDecline: true }) }),
    });
    expect(screen.getByText(/Votação da dupla/)).toBeInTheDocument();
    expect(screen.getByText('Caio votou: Retruco!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quero' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Não quero' }));
    expect(a.respond).toHaveBeenCalledWith(false);
  });

  it('com parceiro CPU não tem votação', () => {
    const seats = [seatPlayer(0), seatPlayer(1), seatPlayer(2, { bot: true }), seatPlayer(3)];
    const match = matchView({ turn: 1, cardsLeft: [3, 3, 3, 3], phase: 'AWAITING_RESPONSE', pending: { kind: 'truco', call: 'truco', chain: ['truco'], seat: 1, team: 1, votes: 0 } });
    renderTable({
      state: roomState({ settings: { size: 4, target: 12, flor: true }, seats, match }),
      hand: privateHand({ actions: handActions({ canPlay: false, canFold: false, calls: [], canAccept: true, canDecline: true }) }),
    });
    expect(screen.queryByText(/Votação da dupla/)).not.toBeInTheDocument();
  });

  it('explica como saiu a flor na placa', () => {
    useGaudStore.getState().addEffect({
      kind: 'side',
      result: { kind: 'flor', winnerTeam: 1, points: 6, seat: 1, chain: ['flor', 'contraflor'], accepted: true, outcome: 'compared', teamPoints: [26, 33], bestSeats: [0, 1] },
    });
    renderTable();
    expect(screen.getByText('🌸 Flor de Bia: 33!')).toBeInTheDocument();
    expect(screen.getByText('33 contra 26 de você · Flor → Contra-flor · +6 para eles')).toBeInTheDocument();
  });

  it('em duplas mostra os três outros lugares e os cards da rodada', () => {
    const seats = [0, 1, 2, 3].map((s) => seatPlayer(s as 0 | 1 | 2 | 3));
    const match = matchView({
      turn: 2,
      cardsLeft: [2, 2, 3, 3],
      rounds: [
        {
          plays: [
            { seat: 0, card: { rank: 3, suit: 'ouros' }, hidden: false },
            { seat: 1, card: null, hidden: true },
          ],
          result: null,
          winningSeat: null,
        },
      ],
    });
    renderTable({ state: roomState({ settings: { size: 4, target: 24, flor: false }, seats, match }), hand: privateHand({ actions: handActions({ canPlay: false, canFold: false, calls: [] }) }) });
    for (const name of ['Bia', 'Caio', 'Duda']) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByText('Vez de Caio')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '3 de ouros' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nós: 0 pontos')).toBeInTheDocument();
  });

  it('mostra o resultado e oferece revanche', async () => {
    const a = renderTable({
      state: roomState({
        phase: 'FINISHED',
        scores: [12, 7],
        result: {
          winnerTeam: 0,
          reason: 'points',
          scores: [12, 7],
          finish: {
            by: 'flor',
            points: 3,
            side: { kind: 'flor', winnerTeam: 0, points: 3, seat: 1, chain: ['flor'], accepted: false, outcome: 'uncontested', teamPoints: [null, null], bestSeats: [null, null] },
          },
        },
      }),
    });
    expect(screen.getByRole('heading', { name: 'Vitória!' })).toBeInTheDocument();
    expect(screen.getByText(/Fecharam com a flor de Bia \(\+3\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Jogar de novo/ }));
    expect(a.rematch).toHaveBeenCalled();
  });
});
