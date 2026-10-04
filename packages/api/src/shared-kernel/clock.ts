/** The current time. Entry points inject `systemClock`; tests inject a clock they control. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
