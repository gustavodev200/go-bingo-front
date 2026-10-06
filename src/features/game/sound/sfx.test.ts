import { SFX_NOTES, sfxFor, type SoundState } from './sfx';

const s = (over: Partial<SoundState> = {}): SoundState => ({ drawnCount: 0, oneAway: new Set(), winnerId: null, ended: false, ...over });

describe('sfxFor', () => {
  it('first snapshot is silent (join / reload mid-game)', () => {
    expect(sfxFor(null, s({ drawnCount: 40, oneAway: new Set(['a']), winnerId: 'a', ended: true }), 'me')).toEqual([]);
  });
  it('a new number plays the draw sound once', () => {
    expect(sfxFor(s({ drawnCount: 3 }), s({ drawnCount: 4 }), 'me')).toEqual(['draw']);
  });
  it('nothing when the count did not grow (duplicate event, replay reset)', () => {
    expect(sfxFor(s({ drawnCount: 4 }), s({ drawnCount: 4 }), 'me')).toEqual([]);
    expect(sfxFor(s({ drawnCount: 40 }), s({ drawnCount: 0 }), 'me')).toEqual([]);
  });
  it('someone newly one away', () => {
    expect(sfxFor(s({ oneAway: new Set(['a']) }), s({ oneAway: new Set(['a', 'b']) }), 'me')).toEqual(['one-away']);
    expect(sfxFor(s({ oneAway: new Set(['a']) }), s({ oneAway: new Set(['a']) }), 'me')).toEqual([]);
  });
  it('fanfare for my win, chord for someone else', () => {
    expect(sfxFor(s(), s({ winnerId: 'me' }), 'me')).toEqual(['bingo-me']);
    expect(sfxFor(s(), s({ winnerId: 'ana' }), 'me')).toEqual(['bingo-other']);
  });
  it('game ended without winner', () => {
    expect(sfxFor(s(), s({ ended: true }), 'me')).toEqual(['ended']);
  });
  it('every sound has audible, finite notes', () => {
    for (const notes of Object.values(SFX_NOTES)) {
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.freq).toBeGreaterThan(50);
        expect(n.dur).toBeGreaterThan(0);
        expect(n.gain).toBeGreaterThan(0);
        expect(n.gain).toBeLessThanOrEqual(0.3);
      }
    }
  });

  it('a resync that jumps several numbers (reconnect) is silent', () => {
    expect(sfxFor(s({ drawnCount: 10, oneAway: new Set() }), s({ drawnCount: 14, oneAway: new Set(['a']) }), 'me')).toEqual([]);
  });
});
