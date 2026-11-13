import type { OwnerNotifications, StoreSettings } from '../domain/store-settings';

export type { OwnerNotifications };

export type GetOwnerNotifications = () => Promise<OwnerNotifications>;

/** Query, for other contexts: where the store settings send the owner's notices. */
export function getOwnerNotifications(deps: { storeSettings: StoreSettings }): GetOwnerNotifications {
  return () => deps.storeSettings.ownerNotifications();
}
