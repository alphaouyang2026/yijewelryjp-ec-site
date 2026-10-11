import { useOutletContext } from 'react-router';
import { CSRF_HEADER, type AdminSession } from '../../../api';

/**
 * The signed-in owner's session, which the admin's frame (AdminFramePage)
 * gives the admin page inside it.
 */
export function useAdminSession(): AdminSession {
  return useOutletContext<AdminSession>();
}

/** The headers every data-changing admin request carries: the session's CSRF token. */
export function useCsrfHeaders(): Record<typeof CSRF_HEADER, string> {
  return { [CSRF_HEADER]: useAdminSession().csrfToken };
}
