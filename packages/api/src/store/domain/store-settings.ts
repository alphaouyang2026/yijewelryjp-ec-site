import { yen, type Money } from '../../shared-kernel/money';

/** What shipping costs: the fee (tax-inclusive), and the subtotal from which shipping is free. */
export type ShippingRates = { readonly fee: Money; readonly freeShippingThreshold: Money };

/**
 * The shipping rates until the owner sets them: placeholders the owner is
 * still to confirm. An entry point may configure others.
 */
export const DEFAULT_SHIPPING_RATES: ShippingRates = { fee: yen(800), freeShippingThreshold: yen(20_000) };

/**
 * Where the owner's notices (such as new orders) go; without an address,
 * none is sent. Their locale is a setting to come (#16): Japanese until then.
 */
export type OwnerNotifications = { readonly email: string | undefined };

/** The store settings. Until the owner can edit them (#16), the configured defaults. */
export interface StoreSettings {
  shippingRates(): Promise<ShippingRates>;
  ownerNotifications(): Promise<OwnerNotifications>;
}
