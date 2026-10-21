import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { gaudActions, handActions, privateHand, roomState, seatPlayer } from '@/test/gauderio-fixtures';
import { envidoSum } from './my-hand';
import { useGaudStore } from './store';
import { TableView } from './table-view';

vi.mock('@/features/arena/reward-panel', () => ({ MatchRewardPanel: () => null }));

const audio = { voice: true, setVoice: vi.fn(), sfx: true, setSfx: vi.fn() };

describe('chat rápido', () => {
  beforeEach(() => useGaudStore.getState().reset());

  it('em duplas fala com o parceiro CPU e mostra a resposta em balão e no histórico', async () => {
    const a = gaudActions();
    const seats = [seatPlayer(0), seatPlayer(1), seatPlayer(2, { bot: true, nickname: 'CPU Tchê' }), seatPlayer(3)];
    render(<TableView state={roomState({ settings: { size: 4, target: 12, flor: true }, seats })} mySeat={0} hand={privateHand()} actions={a} audio={audio} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    const panel = screen.getByRole('dialog', { name: 'Chat rápido' });
    expect(within(panel).getByRole('tab', { name: 'Parceiro (CPU)' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(within(panel).getByRole('button', { name: 'Consegue fazer a primeira?' }));
    expect(a.chat).toHaveBeenCalledWith('team', 'first');
    act(() => useGaudStore.getState().addChat({ seat: 2, to: 'team', text: 'Faço sim, tenho o Espadão!', bot: true }));
    expect(within(panel).getByText('Faço sim, tenho o Espadão!')).toBeInTheDocument();
    expect(screen.getAllByText('Faço sim, tenho o Espadão!')).toHaveLength(2);
    await userEvent.click(within(panel).getByRole('tab', { name: 'Mesa' }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Vem que tem!' }));
    expect(a.chat).toHaveBeenCalledWith('table', 'taunt');
  });

  it('mano a mano só tem a mesa', async () => {
    const a = gaudActions();
    render(<TableView state={roomState()} mySeat={0} hand={privateHand()} actions={a} audio={audio} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bom jogo!' }));
    expect(a.chat).toHaveBeenCalledWith('table', 'gg');
  });

  it('mostra por que o envido não está liberado', () => {
    render(
      <TableView
        state={roomState()}
        mySeat={0}
        hand={privateHand({ actions: handActions({ calls: ['retruco'], envidoNote: 'Depois do truco aceito não tem envido' }) })}
        actions={gaudActions()}
        audio={audio}
      />,
    );
    expect(screen.getByRole('note')).toHaveTextContent('Depois do truco aceito não tem envido');
  });
});

describe('envidoSum', () => {
  it('figuras valem zero na conta', () => {
    expect(
      envidoSum([
        { rank: 10, suit: 'espadas' },
        { rank: 6, suit: 'espadas' },
      ]),
    ).toBe('20 + Sota 0 + 6');
    expect(
      envidoSum([
        { rank: 10, suit: 'espadas' },
        { rank: 11, suit: 'espadas' },
      ]),
    ).toBe('20 + Sota 0 + Cavalo 0');
    expect(envidoSum([{ rank: 4, suit: 'ouros' }])).toBe('4');
  });
});
