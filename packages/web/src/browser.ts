/**
 * Leaving the React app for a page it does not route, such as the API's
 * sign-in, which sends the browser on to the identity provider. Tests watch
 * `leaveFor` to see where the browser would go (jsdom cannot navigate).
 */
export const browser = {
  leaveFor(url: string) {
    window.location.assign(url);
  },
};
