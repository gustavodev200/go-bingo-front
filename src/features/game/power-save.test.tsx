import { act, render } from '@testing-library/react';
import { PowerSaveSync } from './power-save';
import { writeQualityOverride } from './scene3d/scene-prefs';

describe('PowerSaveSync', () => {
  beforeEach(() => localStorage.clear());

  it('flags <html> while the battery saver (low quality) is on, in sync with the setting', () => {
    const { unmount } = render(<PowerSaveSync />);
    expect(document.documentElement).not.toHaveAttribute('data-power-save');
    act(() => writeQualityOverride('low'));
    expect(document.documentElement).toHaveAttribute('data-power-save');
    act(() => writeQualityOverride('high'));
    expect(document.documentElement).not.toHaveAttribute('data-power-save');
    act(() => writeQualityOverride('low'));
    unmount();
    expect(document.documentElement).not.toHaveAttribute('data-power-save');
  });

  it('starts flagged when the saver was left on', () => {
    localStorage.setItem('go-bingo:scene-quality', 'low');
    render(<PowerSaveSync />);
    expect(document.documentElement).toHaveAttribute('data-power-save');
  });
});
