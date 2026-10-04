import type { Clock } from '../../shared-kernel/clock';
import type { DatabaseProbe } from '../domain/database-probe';

export type Health = { status: 'ok'; time: string } | { status: 'unavailable' };

export type CheckHealth = () => Promise<Health>;

/** Use case: whether the API can serve requests, with the server's current time when it can. */
export function checkHealth(deps: { databaseProbe: DatabaseProbe; clock: Clock }): CheckHealth {
  return async () => {
    try {
      await deps.databaseProbe.check();
    } catch (error) {
      console.error('Health check could not reach the database table', error);
      return { status: 'unavailable' };
    }
    return { status: 'ok', time: deps.clock.now().toISOString() };
  };
}
