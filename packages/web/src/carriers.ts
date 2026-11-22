import type { Carrier } from './api';

/** A shipment's carrier by name: the owner's name for 'other', or the carrier's name from `carriers` (the page's locale). */
export function carrierNameOf(
  shipment: { carrier: Carrier; carrierName: string | null },
  carriers: Record<Carrier, string>,
): string {
  return shipment.carrierName ?? carriers[shipment.carrier];
}
