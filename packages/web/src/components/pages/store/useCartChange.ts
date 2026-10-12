import { useState } from 'react';
import { useRevalidator } from 'react-router';

/** What a request to change the cart came to: whether the API answered it, and what the page makes of it. */
export type CartChangeAnswer<Result> = { answered: boolean; result: Result };

/**
 * Sends a store page's changes to the cart: `busy` while one is on its way.
 * Once the API has answered, whether or not it changed the cart, the page's
 * data is reloaded, so the page and the header's count show the cart (and the
 * catalog) as they are now. A request that throws comes to `failed`.
 */
export function useCartChange() {
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);

  async function send<Result>(request: () => Promise<CartChangeAnswer<Result>>, failed: Result): Promise<Result> {
    setBusy(true);
    let answer: CartChangeAnswer<Result>;
    try {
      answer = await request();
    } catch {
      answer = { answered: false, result: failed };
    }
    if (answer.answered) await revalidator.revalidate();
    setBusy(false);
    return answer.result;
  }

  return { busy, send };
}
