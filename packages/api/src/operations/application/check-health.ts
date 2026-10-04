import type { Clock } from '../../shared-kernel/clock';

/** The API's database, as the health check sees it. */
export interface DatabaseProbe {
  /** Resolves if the database answers and the API's table exists; rejects otherwise. */
  check(): Promise<void>;
}

export type Health = { status: 'ok'; time: string } | { status: 'unavailable' };

export type CheckHealth = () => Promise<Health>;

/** Use case: whether the API can serve requests, with the server's current time when it can. */
export function checkHealth(deps: { database: DatabaseProbe; clock: Clock }): CheckHealth {
  return async () => {
    try {
      await deps.database.check();
    } catch (error) {
      console.error('Health check could not reach the database table', error);
      return { status: 'unavailable' };
    }
    return { status: 'ok', time: deps.clock.now().toISOString() };
  };
}
