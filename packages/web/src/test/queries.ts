import { within } from '@testing-library/react';

/** The text of each link in `container`, in page order. */
export function linkTexts(container: HTMLElement) {
  return within(container)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

/** Where each link in `container` points, in page order. */
export function linkHrefs(container: HTMLElement) {
  return within(container)
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));
}
