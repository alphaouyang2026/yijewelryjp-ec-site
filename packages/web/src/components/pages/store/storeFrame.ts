import { useOutletContext } from 'react-router';

/** What the store's frame (StoreFramePage) gives the store page inside it. */
export type StoreFrame = { cartItemCount: number | null };

/**
 * How many items the cart holds, for the header; null when it is not known
 * (the cart could not be read, or the page is the frame's own error page,
 * shown outside the frame).
 */
export function useCartItemCount(): number | null {
  return useOutletContext<StoreFrame | undefined>()?.cartItemCount ?? null;
}
