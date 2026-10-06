/**
 * Ao desmontar, o R3F chama `gl.forceContextLoss()`, que dispara um `webglcontextlost` de verdade.
 * O guard separa essa perda "de propósito" (depois de `dispose`) de uma perda real do aparelho.
 */
export function contextLossGuard(onLost: () => void) {
  let active = true;
  return {
    handle(event: Event) {
      if (!active) return;
      active = false;
      event.preventDefault();
      onLost();
    },
    dispose() {
      active = false;
    },
  };
}
