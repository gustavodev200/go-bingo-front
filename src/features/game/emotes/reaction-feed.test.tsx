import { act, render, screen } from '@testing-library/react';
import type { RoomSnapshot } from '@/contracts';
import { initialGameState, reduce, REACTION_MS, useGameStore } from '../store';
import { ReactionFeed } from './reaction-feed';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const snapshot: RoomSnapshot = {
  code: 'ABC234', name: 'Sala', hostId: ME, maxPlayers: 10, isPublic: true, status: 'WAITING', winPattern: 'FULL_CARD',
  members: [
    { userId: ME, nickname: 'Eu', character: null, slot: 0, isGuest: false, connected: true, hasCard: false },
    { userId: ANA, nickname: 'Ana', character: null, slot: 1, isGuest: false, connected: true, hasCard: false },
  ],
  myCard: null, game: null,
};

describe('ReactionFeed', () => {
  beforeEach(() => useGameStore.setState(reduce(initialGameState(ME), { event: 'room:state', payload: snapshot })));
  afterEach(() => vi.useRealTimers());

  it('shows who reacted and drops the reaction after REACTION_MS', () => {
    vi.useFakeTimers();
    render(<ReactionFeed />);
    act(() => useGameStore.getState().dispatch({ event: 'room:emoted', payload: { userId: ANA, emote: 'laugh' } }));
    expect(screen.getByRole('log')).toHaveTextContent('Ana');
    expect(screen.getByRole('log')).toHaveTextContent('😂');
    expect(screen.getByText('Ana reagiu: risada')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(REACTION_MS));
    expect(screen.queryByText('Ana reagiu: risada')).not.toBeInTheDocument();
    expect(useGameStore.getState().reactions).toEqual([]);
  });

  it('labels my own reaction as "Você"', () => {
    render(<ReactionFeed />);
    act(() => useGameStore.getState().dispatch({ event: 'room:emoted', payload: { userId: ME, emote: 'clap' } }));
    expect(screen.getByRole('log')).toHaveTextContent('Você');
  });

  it('a burst never resurfaces old reactions: every one expires on time, shown or not', () => {
    vi.useFakeTimers();
    render(<ReactionFeed />);
    act(() => {
      for (let i = 0; i < 6; i++) useGameStore.getState().dispatch({ event: 'room:emoted', payload: { userId: ANA, emote: 'clap' } });
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    act(() => vi.advanceTimersByTime(REACTION_MS));
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(useGameStore.getState().reactions).toEqual([]);
  });
});
