import type { ConsoleMessage, Page } from '@playwright/test';

export function trackCspViolations(page: Page): string[] {
  const violations: string[] = [];
  const onConsole = (msg: ConsoleMessage) => {
    if (/content security policy/i.test(msg.text())) violations.push(msg.text());
  };
  page.on('console', onConsole);
  // Workers (ex.: troika) reportam violações no console do próprio worker.
  page.on('worker', (worker) => worker.on('console', onConsole));
  return violations;
}
