import { yen, type Money } from '../../shared-kernel/money';
import { DEFAULT_SHIPPING_RATES, type ShippingRates, type StoreSettings } from '../domain/store-settings';

/**
 * Store settings the entry point configures, which the owner cannot change:
 * the production adapter until the owner can edit the settings in the admin
 * (#16), whose settings will fall back to these.
 */
export function configuredStoreSettings(rates: ShippingRates): StoreSettings {
  return { shippingRates: () => Promise.resolve(rates) };
}

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The shipping rates the environment configures: SHIPPING_FEE_YEN and
 * FREE_SHIPPING_THRESHOLD_YEN, each a whole number of yen, with the default
 * for one that is not set. Throws on a value that is not a whole number of yen.
 */
export function shippingRatesFromEnv(env: Env): ShippingRates {
  return {
    fee: yenFromEnv(env, 'SHIPPING_FEE_YEN') ?? DEFAULT_SHIPPING_RATES.fee,
    freeShippingThreshold:
      yenFromEnv(env, 'FREE_SHIPPING_THRESHOLD_YEN') ?? DEFAULT_SHIPPING_RATES.freeShippingThreshold,
  };
}

function yenFromEnv(env: Env, name: string): Money | undefined {
  const value = env[name]?.trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${name} must be a whole number of yen, got ${value}`);
  }
  return yen(Number(value));
}
