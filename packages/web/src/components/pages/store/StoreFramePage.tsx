import { Outlet, useLoaderData } from 'react-router';
import type { StoreFrame } from './storeFrame';
import type { storeFrameLoader } from './storeFrameLoader';

/**
 * Every store page's frame: it reads the cart once, and gives the pages
 * inside it the cart's quantity for their header. A cart change reloads it
 * (useRevalidator), so the count follows the cart.
 */
export function StoreFramePage() {
  const { cartQuantity } = useLoaderData<typeof storeFrameLoader>();
  return <Outlet context={{ cartQuantity } satisfies StoreFrame} />;
}
