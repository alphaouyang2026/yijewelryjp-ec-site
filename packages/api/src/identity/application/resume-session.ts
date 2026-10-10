import type { Clock } from '../../shared-kernel/clock';
import { expiresAt, isExpired, touch, type AdminSession } from '../domain/admin-session';

export type { AdminSession };
export { expiresAt };

export type ResumeSession = (session: AdminSession | undefined) => AdminSession | undefined;

/**
 * Use case: an admin request goes on in the owner's session. Undefined when
 * there is none or it has ended (idle too long, or signed in too long ago);
 * otherwise the session, active now.
 */
export function resumeSession(deps: { clock: Clock }): ResumeSession {
  return (session) => {
    const now = deps.clock.now();
    if (!session || isExpired(session, now)) return undefined;
    return touch(session, now);
  };
}
