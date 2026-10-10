import type { Clock } from '../../shared-kernel/clock';
import { isExpired, SESSION_IDLE_TIMEOUT_MS, touch, type AdminSession } from '../domain/admin-session';

export type { AdminSession };
export { SESSION_IDLE_TIMEOUT_MS };

export type ResumeSession = (session: AdminSession | undefined) => AdminSession | undefined;

/**
 * Use case: an admin request goes on in the owner's session. Undefined when
 * there is none or it went idle too long; otherwise the session, active now.
 */
export function resumeSession(deps: { clock: Clock }): ResumeSession {
  return (session) => {
    const now = deps.clock.now();
    if (!session || isExpired(session, now)) return undefined;
    return touch(session, now);
  };
}
