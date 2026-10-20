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
    expect(screen.getByText('Envido: 33')).toBeInTheDocument();
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
    const state = roomState({ match: matchView({ turn: 1, phase: 'AWAITING_RESPONSE', pending: { kind: 'truco', call: 'truco', chain: ['truco'], seat: 1, team: 1 } }) });
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
    const state = roomState({ match: matchView({ phase: 'AWAITING_RESPONSE', pending: { kind: 'envido', call: 'envido', chain: ['envido'], seat: 0, team: 0 } }) });
    renderTable({ state, hand: privateHand({ actions: handActions({ canPlay: false, canFold: false, calls: [] }) }) });
    expect(screen.getByText('Esperando a resposta ao Envido…')).toBeInTheDocument();
  });

  it('pede a flor antes de jogar', () => {
    renderTable({ hand: privateHand({ flor: true, actions: handActions({ canPlay: false, calls: ['truco', 'flor'] }) }) });
    expect(screen.getByRole('button', { name: 'Flor!' })).toBeInTheDocument();
    expect(screen.getByText('Você tem flor: cante antes de jogar!')).toBeInTheDocument();
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
    const a = renderTable({ state: roomState({ phase: 'FINISHED', scores: [12, 7], result: { winnerTeam: 0, reason: 'points', scores: [12, 7] } }) });
    expect(screen.getByRole('heading', { name: 'Vitória!' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Jogar de novo/ }));
    expect(a.rematch).toHaveBeenCalled();
  });
});
