/**
 * Renders nothing on first load while the route's loader runs. Giving routes
 * this explicit fallback keeps React Router from warning that none was provided.
 */
export function BlankHydrateFallback() {
  return null;
}
