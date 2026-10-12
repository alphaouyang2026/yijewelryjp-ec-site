import { useOutletContext } from 'react-router';

/** What the store's frame (StoreFramePage) gives the store page inside it. */
export type StoreFrame = { cartQuantity: number | null };

/**
 * How many the cart holds (every line's quantity summed), for the header;
 * null when it is not known (the cart could not be read, or the page is the
 * frame's own error page, shown outside the frame).
 */
export function useCartQuantity(): number | null {
  return useOutletContext<StoreFrame | undefined>()?.cartQuantity ?? null;
}
