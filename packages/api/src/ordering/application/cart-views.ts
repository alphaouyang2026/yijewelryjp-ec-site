import type { CartNotice } from '../domain/cart';

// How the cart use cases show the cart to the storefront: texts in the
// requested locale (Japanese where a translation is missing), money as yen.
// The storefront shows the amounts as they are; it computes none itself.

export type { CartNotice };

/** A line of the cart as the customer sees it, checked against the catalog now. */
export type CartLineView = {
  /** With the SKU, which line it is. */
  productSlug: string;
  sku: string;
  name: string;
  /** Null when the product no longer has the variant. */
  variantLabel: string | null;
  /** The product's main photo. */
  photo: { url: string; alt: string } | null;
  /** The unit price now; the price the customer saw when the product no longer has the variant. */
  priceYen: number;
  /** The quantity the cart counts: at most the available stock, for a line that can be bought. */
  quantity: number;
  /** The most the customer can have of the variant now; 0 when the line cannot be bought. */
  maxQuantity: number;
  /** Price × quantity; 0 when the line cannot be bought. */
  lineTotalYen: number;
  /** Whether the line can be bought, and so counts in the amounts. */
  available: boolean;
  notices: CartNotice[];
};

/** The customer's cart, its lines checked against the catalog, with its amounts (tax-inclusive). */
export type CartView = {
  /** In the order they were first added. */
  lines: CartLineView[];
  /** Every line's quantity, those that cannot be bought too: the count the site's header shows. */
  itemCount: number;
  subtotalYen: number;
  shippingYen: number;
  totalYen: number;
  freeShippingThresholdYen: number;
  /** How much more the subtotal needs for free shipping; 0 once it has it. */
  freeShippingRemainingYen: number;
  /** The most lines the cart can hold. */
  maxLines: number;
};
