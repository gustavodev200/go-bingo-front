import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { matchView, privateHand, roomState } from '@/test/truco-fixtures';
import type { TrucoActions } from './connection';
import { DEFAULT_CONVENTIONS } from './signals';
import { useTrucoStore } from './store';
import { TableView } from './table-view';

function actions(): TrucoActions {
  const ok = () => vi.fn(async () => true);
  return { leave: ok(), ready: ok(), takeSeat: ok(), setVisibility: ok(), setMode: ok(), start: ok(), rematch: ok(), playCard: ok(), requestBet: ok(), respondBet: ok(), decideTen: ok(), signal: ok() };
}
const audio = { voice: true, setVoice: vi.fn(), sfx: true, setSfx: vi.fn() };

function renderTable(props: Partial<Parameters<typeof TableView>[0]> = {}) {
  const a = actions();
  const onSignalSent = vi.fn();
  render(<TableView state={roomState()} mySeat={0} hand={privateHand()} actions={a} conventions={DEFAULT_CONVENTIONS} audio={audio} onSignalSent={onSignalSent} {...props} />);
  return { a, onSignalSent };
}

describe('TableView', () => {
  beforeEach(() => useTrucoStore.getState().reset());

  it('shows the scoreboard from my side, the three other seats and my cards', () => {
    renderTable({ state: roomState({ scores: [4, 8] }) });
    expect(screen.getByLabelText('Nós: 4 tentos')).toBeInTheDocument();
    expect(screen.getByLabelText('Eles: 8 tentos')).toBeInTheDocument();
    for (const name of ['Bia', 'Caio', 'Duda']) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getAllByLabelText('3 cartas na mão')).toHaveLength(3);
    const hand = screen.getByRole('list', { name: 'Suas cartas' });
    expect(within(hand).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Jogar 4 de paus (Zap)' })).toBeEnabled();
    expect(screen.getByText('Sua vez!')).toBeInTheDocument();
  });

  it('plays a card and asks for truco on my turn', async () => {
    const { a } = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Jogar 3 de copas' }));
    expect(a.playCard).toHaveBeenCalledWith('h1s0c1');
    await userEvent.click(screen.getByRole('button', { name: 'Truco!' }));
    expect(a.requestBet).toHaveBeenCalled();
  });

  it('disables my cards when it is not my turn and says whose turn it is', () => {
    renderTable({ state: roomState({ match: matchView({ turn: 1 }) }) });
    expect(screen.getByRole('button', { name: 'Jogar 3 de copas' })).toBeDisabled();
    expect(screen.getByText('Vez de Bia')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Truco!' })).not.toBeInTheDocument();
  });

  it('lets the opponents accept, run or raise a truco', async () => {
    const state = roomState({ match: matchView({ turn: 1, phase: 'AWAITING_BET_RESPONSE', pendingBet: { value: 3, requestedBy: 1, team: 1 } }) });
    const { a } = renderTable({ state });
    const group = screen.getByRole('group', { name: 'Responder aposta' });
    await userEvent.click(within(group).getByRole('button', { name: 'Seis!' }));
    expect(a.respondBet).toHaveBeenCalledWith('raise');
    await userEvent.click(within(group).getByRole('button', { name: 'Correr' }));
    expect(a.respondBet).toHaveBeenCalledWith('run');
  });

  it('shows the partner cards and the choice in a mão de dez', async () => {
    const state = roomState({ scores: [10, 2], match: matchView({ phase: 'AWAITING_TEN_DECISION', kind: 'ten', tenTeam: 0, value: 4 }) });
    const { a } = renderTable({ state, hand: privateHand({ partnerCards: [{ rank: '7', suit: 'hearts' }] }) });
    expect(screen.getByRole('img', { name: '7 de copas (Copeta)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Jogar' }));
    expect(a.decideTen).toHaveBeenCalledWith(true);
    expect(screen.getByText(/Mão de dez · Vale 4/)).toBeInTheDocument();
  });

  it('uses the goiano rules: mão de 14 worth 3, game to 15', () => {
    const state = roomState({ mode: 'goiano', scores: [14, 2], match: matchView({ phase: 'AWAITING_TEN_DECISION', kind: 'ten', tenTeam: 0, value: 3 }) });
    renderTable({ state, hand: privateHand({ partnerCards: [{ rank: '7', suit: 'hearts' }] }) });
    expect(screen.getByText(/Mão de 14 · Vale 3/)).toBeInTheDocument();
    expect(screen.getByText('Tentos · até 15')).toBeInTheDocument();
    expect(screen.getByText(/correndo, eles ganham 1/)).toBeInTheDocument();
  });

  it('shows blind cards in the mão de ferro', () => {
    const state = roomState({ scores: [10, 10], match: matchView({ kind: 'iron' }) });
    renderTable({ state, hand: privateHand({ cards: [{ id: 'a', card: null }, { id: 'b', card: null }] }) });
    expect(screen.getByRole('button', { name: 'Jogar carta oculta 1' })).toBeEnabled();
    expect(screen.getByText('Mão de ferro · cartas às cegas')).toBeInTheDocument();
  });

  it('marks a reconnecting player and the played cards in front of each seat', () => {
    const state = roomState({
      seats: roomState().seats.map((s, i) => (i === 1 ? { ...s!, connected: false, reconnectDeadline: Date.now() + 30_000 } : s)),
      match: matchView({ turn: 2, rounds: [{ plays: [{ seat: 1, card: { rank: 'K', suit: 'clubs' } }], result: null, winningSeat: null }], cardsLeft: [3, 2, 3, 3] }),
    });
    renderTable({ state });
    expect(screen.getByText(/Reconectando 30s/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rei de paus' })).toBeInTheDocument();
  });

  it('sends a secret signal and shows only my partner gesture meaning', async () => {
    const { a, onSignalSent } = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Sinal secreto para o parceiro' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Piscada/ }));
    expect(a.signal).toHaveBeenCalledWith('wink');
    expect(onSignalSent).toHaveBeenCalledWith('wink');
    act(() => {
      useTrucoStore.getState().addEffect({ kind: 'gesture', seat: 2, gesture: 'tongue' });
      useTrucoStore.getState().addEffect({ kind: 'gesture', seat: 1, gesture: null });
    });
    expect(screen.getByText(DEFAULT_CONVENTIONS.tongue)).toBeInTheDocument();
    expect(screen.getByLabelText('fez um gesto')).toBeInTheDocument();
  });

  it('shows the TRUCO shout', () => {
    renderTable();
    act(() => void useTrucoStore.getState().addEffect({ kind: 'shout', text: 'TRUCO!', tone: 'bet' }));
    expect(screen.getByText('TRUCO!')).toBeInTheDocument();
  });

  it('asks before leaving a running match and offers a rematch at the end', async () => {
    const { a } = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Sair da mesa' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sair e entregar' }));
    expect(a.leave).toHaveBeenCalled();
  });

  it('shows the result with a rematch', async () => {
    const { a } = renderTable({ state: roomState({ phase: 'FINISHED', scores: [12, 6], result: { winnerTeam: 0, reason: 'points', scores: [12, 6] } }) });
    const dialog = screen.getByRole('dialog', { name: 'Vitória!' });
    await userEvent.click(within(dialog).getByRole('button', { name: /Jogar de novo/ }));
    expect(a.rematch).toHaveBeenCalled();
  });

  it('toggles voice and sound independently', async () => {
    Object.defineProperty(window, 'speechSynthesis', { value: { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] }, configurable: true });
    renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Desligar som' }));
    expect(audio.setSfx).toHaveBeenCalledWith(false);
  });
});
