import type { ShippingRates, StoreSettings } from '../domain/store-settings';

export type { ShippingRates };

export type GetShippingRates = () => Promise<ShippingRates>;

/** Query, for other contexts: the shipping fee and the free shipping threshold in the store settings. */
export function getShippingRates(deps: { storeSettings: StoreSettings }): GetShippingRates {
  return () => deps.storeSettings.shippingRates();
}
