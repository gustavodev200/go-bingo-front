import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoomSnapshot } from '@/contracts';
import { RoomScreen } from './room-screen';
import { useGameStore } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));

const push = vi.fn();
const toast = vi.fn();
const actions = { generateCard: vi.fn(), start: vi.fn(), cancel: vi.fn(), leave: vi.fn(async () => undefined), kick: vi.fn(), mark: vi.fn(), claim: vi.fn(), replay: vi.fn() };

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/ABC234' }));
vi.mock('sonner', () => ({ toast: Object.assign((msg: string) => toast(msg), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({ profile: { id: ME, nickname: 'Eu', isGuest: false, points: 0 }, refresh: vi.fn() }),
}));
const hooks = vi.hoisted(() => ({ onDrawLatency: undefined as ((ms: number) => void) | undefined, onContextLoss: undefined as (() => void) | undefined }));
vi.mock('./use-game-connection', () => ({
  useGameConnection: (_code: string, onDrawLatency?: (ms: number) => void) => {
    hooks.onDrawLatency = onDrawLatency;
    return actions;
  },
}));
const SCENE_2D = { mode: '2d' as '2d' | '3d', reason: 'user' as string, setPreferred: vi.fn(), quality: 'auto', setQuality: vi.fn(), reportContextLoss: vi.fn(), reportFailure: vi.fn(), stageKey: 0 };
const sceneMode = vi.hoisted(() => ({ value: null as unknown as typeof SCENE_2D }));
vi.mock('./use-scene-mode', () => ({
  useSceneMode: (onContextLoss?: () => void) => {
    hooks.onContextLoss = onContextLoss;
    return sceneMode.value;
  },
}));
const reportSessionSummary = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', async (orig) => ({ ...(await orig<typeof import('@/lib/telemetry')>()), reportSessionSummary }));
vi.mock('./scene3d/game-stage-lazy', () => ({
  GameStageLazy: (props: { onFrame: (ms: number) => void }) => (
    <div data-testid="game-stage">
      <button onClick={() => props.onFrame(16)}>frame</button>
    </div>
  ),
}));
vi.mock('./sound/use-game-sounds', () => ({ useGameSounds: vi.fn() }));
vi.mock('./scene3d/lobby-stage-lazy', () => ({
  LobbyStageLazy: (props: { celebrating: boolean; onContextLost: () => void }) => (
    <div data-testid="lobby-stage" data-celebrating={String(props.celebrating)}>
      <button onClick={props.onContextLost}>perder contexto</button>
    </div>
  ),
}));

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'ABC234', name: 'Amigos', hostId: ME, maxPlayers: 10, isPublic: true, status: 'WAITING',
    members: [
      { userId: ME, nickname: 'Eu', slot: 0, isGuest: false, connected: true, hasCard: false },
      { userId: ANA, nickname: 'Ana', slot: 1, isGuest: true, connected: true, hasCard: true },
    ],
    myCard: null, game: null,
    ...overrides,
  };
}

/** Renderiza (o effect zera a store) e então entrega o snapshot como o socket faria. */
function renderWith(snapshot: RoomSnapshot | null) {
  const view = render(<RoomScreen code="ABC234" />);
  if (snapshot) act(() => useGameStore.getState().dispatch({ event: 'room:state', payload: snapshot }));
  return view;
}

describe('RoomScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().reset(ME); // testes não herdam a sala do anterior
    sceneMode.value = { ...SCENE_2D };
  });

  it('2D mode: lobby HUD only, no canvas', () => {
    renderWith(room());
    expect(screen.queryByTestId('lobby-stage')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver em 3D' })).toBeInTheDocument();
  });

  it('3D mode: stage above the same lobby HUD', () => {
    sceneMode.value = { ...SCENE_2D, mode: '3d', reason: 'ok' };
    renderWith(room());
    expect(screen.getByTestId('lobby-stage')).toHaveAttribute('data-celebrating', 'false');
    expect(screen.getByText('Amigos')).toBeInTheDocument(); // HUD continua
  });

  it('reports a lost WebGL context', async () => {
    sceneMode.value = { ...SCENE_2D, mode: '3d', reason: 'ok' };
    renderWith(room());
    await userEvent.click(screen.getByRole('button', { name: 'perder contexto' }));
    expect(sceneMode.value.reportContextLoss).toHaveBeenCalled();
  });

  it('sends one session summary on leaving the room, with mode, fallback and FPS', async () => {
    sceneMode.value = { ...SCENE_2D, mode: '3d', reason: 'ok' };
    const inGame = room({ status: 'IN_GAME', game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [3], drawIntervalMs: 5000, remaining: {} } });
    const view = renderWith(inGame);
    await userEvent.click(screen.getByRole('button', { name: 'frame' }));
    view.unmount();
    expect(reportSessionSummary).toHaveBeenCalledTimes(1);
    expect(reportSessionSummary).toHaveBeenCalledWith({ mode: '3d', fallbackReason: null, contextLosses: 0, fpsP50: 63, drawLatencyP95Ms: null, draws: 0 });
  });

  it('flushes the summary on pagehide (once) with draw latency, context losses and the fallback reason', () => {
    sceneMode.value = { ...SCENE_2D, mode: '2d', reason: 'context-lost' };
    const view = renderWith(room());
    act(() => {
      hooks.onDrawLatency?.(120);
      hooks.onDrawLatency?.(200);
      hooks.onContextLoss?.();
    });
    act(() => window.dispatchEvent(new Event('pagehide')));
    view.unmount();
    expect(reportSessionSummary).toHaveBeenCalledTimes(1);
    expect(reportSessionSummary).toHaveBeenCalledWith({ mode: '2d', fallbackReason: 'context-lost', contextLosses: 1, fpsP50: null, drawLatencyP95Ms: 200, draws: 2 });
  });

  it('does not report a session where nothing was measured', () => {
    renderWith(room()).unmount();
    expect(reportSessionSummary).not.toHaveBeenCalled();
  });

  it('warns when it falls back to 2D after losing the context', () => {
    sceneMode.value = { ...SCENE_2D, mode: '2d', reason: 'context-lost' };
    renderWith(room());
    expect(toast).toHaveBeenCalledWith('Modo 2D ativado para economizar o aparelho');
  });

  it('3D mode: reloading mid-game goes straight to the game, no celebration', () => {
    sceneMode.value = { ...SCENE_2D, mode: '3d', reason: 'ok' };
    renderWith(
      room({
        status: 'IN_GAME',
        myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] },
        game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [], drawIntervalMs: 5000, remaining: { [ME]: 24 } },
      }),
    );
    expect(screen.queryByTestId('lobby-stage')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bingo/i })).toBeInTheDocument();
  });

  it('warns when the 3D stage could not load', () => {
    sceneMode.value = { ...SCENE_2D, mode: '2d', reason: 'failed' };
    renderWith(room());
    expect(toast).toHaveBeenCalledWith('Não foi possível carregar o 3D; usando o modo 2D.');
  });

  it('3D mode: the game screen gets the 3D stage', () => {
    sceneMode.value = { ...SCENE_2D, mode: '3d', reason: 'ok' };
    renderWith(room({ status: 'IN_GAME', myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] }, game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [], drawIntervalMs: 5000, remaining: { [ME]: 24 } } }));
    expect(screen.getByTestId('game-stage')).toBeInTheDocument();
  });

  it('3D mode: the result dialog waits for the victory scene', () => {
    vi.useFakeTimers();
    try {
      sceneMode.value = { ...SCENE_2D, mode: '3d', reason: 'ok' };
      renderWith(room({ status: 'IN_GAME', myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] }, game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [], drawIntervalMs: 5000, remaining: { [ME]: 24 } } }));
      act(() => useGameStore.getState().dispatch({ event: 'game:won', payload: { userId: ANA, nickname: 'Ana', pointsAwarded: 20, grid } }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(2500));
      expect(screen.getByRole('dialog')).toHaveTextContent('Ana fez BINGO!');
    } finally {
      vi.useRealTimers();
    }
  });

  it('3D mode: celebrates on start before switching to the game', () => {
    vi.useFakeTimers();
    try {
      sceneMode.value = { ...SCENE_2D, mode: '3d', reason: 'ok' };
      renderWith(room());
      act(() =>
        useGameStore.getState().dispatch({
          event: 'room:state',
          payload: room({
            status: 'IN_GAME',
            myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] },
            game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [], drawIntervalMs: 5000, remaining: { [ME]: 24 } },
          }),
        }),
      );
      expect(screen.getByTestId('lobby-stage')).toHaveAttribute('data-celebrating', 'true');
      act(() => vi.advanceTimersByTime(1200));
      expect(screen.queryByTestId('lobby-stage')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bingo/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds a screen wake lock only while the game is running', async () => {
    const sentinel = { released: false, release: vi.fn(async () => undefined) };
    const request = vi.fn(async () => sentinel);
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    try {
      renderWith(room({ status: 'WAITING' }));
      expect(request).not.toHaveBeenCalled();
      act(() =>
        useGameStore.getState().dispatch({
          event: 'room:state',
          payload: room({
            status: 'IN_GAME',
            myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] },
            game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [], drawIntervalMs: 5000, remaining: { [ME]: 24 } },
          }),
        }),
      );
      await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    } finally {
      Reflect.deleteProperty(navigator, 'wakeLock');
    }
  });

  it('shows a loading state until the snapshot arrives', () => {
    renderWith(null);
    expect(screen.getByText(/entrando na sala/i)).toBeInTheDocument();
  });

  it('shows the lobby with the reconnecting banner', () => {
    renderWith(room());
    expect(screen.getByRole('heading', { name: 'Amigos' })).toBeInTheDocument();
    act(() => useGameStore.getState().setConnection('reconnecting'));
    expect(screen.getByText(/reconectando…/i)).toBeInTheDocument();
  });

  it('non-host leaves the room and goes home', async () => {
    renderWith(room({ hostId: ANA }));
    await userEvent.click(screen.getByRole('button', { name: /sair da sala/i }));
    expect(actions.leave).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/');
  });

  it('shows the game while in progress and announces players one away', () => {
    renderWith(room({ status: 'IN_GAME', myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] }, game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [5], drawIntervalMs: 5000, remaining: { [ME]: 3, [ANA]: 2 } } }));
    expect(screen.getByRole('button', { name: /bingo/i })).toBeInTheDocument();
    act(() => useGameStore.getState().dispatch({ event: 'game:progress', payload: { remaining: { [ME]: 1, [ANA]: 1 } } }));
    expect(toast).toHaveBeenCalledWith('Você está por 1!');
    expect(toast).toHaveBeenCalledWith('Ana está por 1!');
  });

  it('shows the result dialog after a win and replays', async () => {
    renderWith(room({ status: 'IN_GAME', game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [], drawIntervalMs: 5000, remaining: {} } }));
    act(() => useGameStore.getState().dispatch({ event: 'game:won', payload: { userId: ANA, nickname: 'Ana', pointsAwarded: 0, grid } }));
    expect(screen.getByText(/ana fez bingo/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /jogar de novo/i }));
    expect(actions.replay).toHaveBeenCalled();
  });

  it('explains why the player left the room', () => {
    renderWith(room());
    act(() => useGameStore.getState().dispatch({ event: 'room:closed', payload: { reason: 'host_cancelled' } }));
    expect(screen.getByRole('alert')).toHaveTextContent('A sala foi encerrada pelo host.');
    act(() => useGameStore.getState().setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou');
  });
});
