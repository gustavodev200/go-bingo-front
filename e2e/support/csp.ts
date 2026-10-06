import type { Page } from '@playwright/test';

export function trackCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (/content security policy/i.test(msg.text())) violations.push(msg.text());
  });
  return violations;
}
