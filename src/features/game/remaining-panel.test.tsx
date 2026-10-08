import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Member } from '@/contracts';
import { RemainingPanel } from './remaining-panel';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const members: Member[] = [
  { userId: ME, nickname: 'Eu', character: null, slot: 0, isGuest: false, connected: true, hasCard: true },
  { userId: ANA, nickname: 'Ana', character: null, slot: 1, isGuest: false, connected: true, hasCard: true },
];

describe('RemainingPanel', () => {
  it('mostra quanto me falta no gatilho e destaca a minha linha', async () => {
    render(<RemainingPanel remaining={{ [ME]: 1, [ANA]: 3 }} members={members} myUserId={ME} />);
    const trigger = screen.getByRole('button', { name: 'Pedras que faltam (você: por 1!)' });
    expect(trigger).toHaveTextContent('Por 1!');
    await userEvent.click(trigger);
    expect(screen.getByText('Eu (você)')).toBeInTheDocument();
  });

  it('mostra "Faltam N" e "Completa!" conforme o meu número', () => {
    const { rerender } = render(<RemainingPanel remaining={{ [ME]: 4 }} members={members} myUserId={ME} />);
    expect(screen.getByRole('button')).toHaveTextContent('Faltam 4');
    rerender(<RemainingPanel remaining={{ [ME]: 0 }} members={members} myUserId={ME} />);
    expect(screen.getByRole('button')).toHaveTextContent('Completa!');
  });

  it('sem número meu (espectador) não mostra badge', () => {
    render(<RemainingPanel remaining={{ [ANA]: 3 }} members={members} myUserId={ME} />);
    expect(screen.getByRole('button', { name: 'Pedras que faltam' })).toBeInTheDocument();
  });

  it('lista quem saiu como "Jogador que saiu"', async () => {
    render(<RemainingPanel remaining={{ gone: 2 }} members={members} myUserId={ME} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Jogador que saiu')).toBeInTheDocument();
  });
});
