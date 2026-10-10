import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ErrorPage } from '../components/pages/status/ErrorPage';
import { NotFoundPage } from '../components/pages/status/NotFoundPage';

/**
 * A store page's error boundary: the not-found page when its loader found no
 * such product or category (404), the error page for anything else. It sits on
 * each page's route, under the locale root, so the page stays in its locale.
 */
export function StoreRouteError() {
  const error = useRouteError();
  return isRouteErrorResponse(error) && error.status === 404 ? <NotFoundPage /> : <ErrorPage />;
}
