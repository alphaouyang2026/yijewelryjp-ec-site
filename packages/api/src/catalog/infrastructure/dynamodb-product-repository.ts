import { queryPartition, type Database } from '../../platform/dynamodb';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Product, ProductRepository } from '../domain/product';

/**
 * The item that puts a listed product in the new arrivals, sorted by when it
 * was listed. Provisional: nothing lists products yet, and ticket #7 confirms
 * or replaces this layout. Until then the API tests seed it directly
 * (test/support/catalog-seed.ts).
 */
export type NewArrivalItem = {
  pk: 'NEW_ARRIVAL';
  sk: string; // `${listedAt ISO 8601}#${slug}`
  slug: string;
  name: LocalizedText;
};

export function dynamoDbProductRepository(db: Database): ProductRepository {
  return {
    async listNewArrivals(limit) {
      const items = await queryPartition<NewArrivalItem>(db, 'NEW_ARRIVAL', { descending: true, limit });
      return items.map(toProduct);
    },
  };
}

function toProduct(item: NewArrivalItem): Product {
  return { slug: item.slug, name: item.name };
}
