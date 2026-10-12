import { createStageActivity } from './stage-activity';

describe('createStageActivity', () => {
  it('is idle until something asks for the active frame rate', () => {
    let now = 1_000;
    const activity = createStageActivity(() => now);
    expect(activity.isActive(now)).toBe(false);
    activity.keepActive(500);
    expect(activity.isActive(now + 499)).toBe(true);
    expect(activity.isActive(now + 500)).toBe(false);
    now = 1_200;
    activity.keepActive(100); // não encurta o pedido anterior
    expect(activity.isActive(1_450)).toBe(true);
  });
});
