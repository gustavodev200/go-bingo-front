import { contextLossGuard } from './context-loss';

describe('contextLossGuard', () => {
  it('reports a real loss once and keeps the context restorable', () => {
    const onLost = vi.fn();
    const guard = contextLossGuard(onLost);
    const event = new Event('webglcontextlost', { cancelable: true });
    guard.handle(event);
    guard.handle(new Event('webglcontextlost', { cancelable: true }));
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores the loss the renderer forces on itself while unmounting', () => {
    const onLost = vi.fn();
    const guard = contextLossGuard(onLost);
    guard.dispose();
    guard.handle(new Event('webglcontextlost', { cancelable: true }));
    expect(onLost).not.toHaveBeenCalled();
  });
});
