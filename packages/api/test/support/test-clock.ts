import type { Clock } from '../../src/clock';

export type TestClock = Clock & {
  set(date: Date): void;
};

export function createTestClock(initial: Date): TestClock {
  let current = initial;
  return {
    now: () => new Date(current),
    set(date) {
      current = date;
    },
  };
}
