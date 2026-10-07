import { LETTER_COLORS } from './ambience';
import { drawScoreboard, scoreboardView, type ScoreboardCtx, type ScoreboardView } from './scoreboard';

type Call = { op: 'fillRect' | 'fillText' | 'arc'; args: unknown[]; fillStyle: string; font: string };

function fakeCtx() {
  const calls: Call[] = [];
  const ctx = {
    fillStyle: '#000',
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillRect: (...args: unknown[]) => calls.push({ op: 'fillRect', args, fillStyle: String(ctx.fillStyle), font: ctx.font }),
    fillText: (...args: unknown[]) => calls.push({ op: 'fillText', args, fillStyle: String(ctx.fillStyle), font: ctx.font }),
    beginPath: () => undefined,
    arc: (...args: unknown[]) => calls.push({ op: 'arc', args, fillStyle: String(ctx.fillStyle), font: ctx.font }),
    fill: () => undefined,
  };
  return { ctx: ctx as unknown as ScoreboardCtx, calls, texts: () => calls.filter((c) => c.op === 'fillText').map((c) => String(c.args[0])) };
}

const draw = (view: ScoreboardView) => {
  const f = fakeCtx();
  drawScoreboard(f.ctx, view);
  return f;
};

describe('drawScoreboard', () => {
  it('lobby: room name and code', () => {
    const f = draw({ kind: 'lobby', name: 'Amigos', code: 'ABC234' });
    expect(f.texts()).toEqual(expect.arrayContaining(['Amigos', 'ABC234']));
  });

  it('game: BINGO sign in the column colors and how many balls came out (the balls themselves live in the DOM HUD)', () => {
    const f = draw({ kind: 'game', drawn: [3, 18, 33, 48, 63, 70] });
    expect(f.texts()).toEqual(expect.arrayContaining(['B', 'I', 'N', 'G', 'O', '6/75']));
    const ballColors = f.calls.filter((c) => c.op === 'arc').map((c) => c.fillStyle);
    expect(ballColors).toEqual(expect.arrayContaining(Object.values(LETTER_COLORS)));
  });

  it('game without draws yet: game started message', () => {
    const f = draw({ kind: 'game', drawn: [] });
    expect(f.texts()).toContain('Começou!');
    expect(f.texts()).not.toContain('0/75');
  });

  it('won: BINGO and the winner nickname, or "Você!" for me', () => {
    expect(draw({ kind: 'won', nickname: 'Ana', isMe: false }).texts()).toEqual(expect.arrayContaining(['BINGO!', 'Ana']));
    expect(draw({ kind: 'won', nickname: 'Ana', isMe: true }).texts()).toContain('Você!');
  });

  it('ended: end-of-game message', () => {
    expect(draw({ kind: 'ended' }).texts()).toContain('Fim de jogo');
  });
});

describe('scoreboardView', () => {
  const base = { phase: 'game' as const, name: 'Sala', code: 'ABC234', drawn: [1, 2], winner: null, ended: false, myUserId: 'me' };
  it('winner beats everything, using the nickname from the store', () =>
    expect(scoreboardView({ ...base, winner: { userId: 'x', nickname: 'Ana' }, ended: true })).toEqual({ kind: 'won', nickname: 'Ana', isMe: false }));
  it('flags my own win', () => expect(scoreboardView({ ...base, winner: { userId: 'me', nickname: 'Eu' } })).toMatchObject({ isMe: true }));
  it('ended without winner', () => expect(scoreboardView({ ...base, ended: true })).toEqual({ kind: 'ended' }));
  it('game shows the draws', () => expect(scoreboardView(base)).toEqual({ kind: 'game', drawn: [1, 2] }));
  it('lobby shows name and code', () => expect(scoreboardView({ ...base, phase: 'lobby' })).toEqual({ kind: 'lobby', name: 'Sala', code: 'ABC234' }));
});
