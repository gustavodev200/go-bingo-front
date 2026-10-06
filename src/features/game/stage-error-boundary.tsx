'use client';

import { Component, type ReactNode } from 'react';

/** Falha no palco 3D (chunk que não baixou, WebGL recusado) não derruba a sala: avisa e some; a HUD continua. */
export class StageErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
