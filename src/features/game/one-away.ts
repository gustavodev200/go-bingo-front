export function newlyOneAway(prev: Record<string, number>, next: Record<string, number>): string[] {
  return Object.entries(next)
    .filter(([userId, remaining]) => remaining === 1 && prev[userId] !== 1)
    .map(([userId]) => userId);
}
