/**
 * The time source for rules that depend on "now" (the sign-in rate limit window, overdue checks).
 * Inject it with `@Inject(CLOCK)`; tests override the provider with a clock they move by hand.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };
