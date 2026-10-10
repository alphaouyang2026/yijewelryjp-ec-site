import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { CategoryItem } from '../../src/catalog/infrastructure/dynamodb-category-repository';
import type { ProductItem, VariantItem } from '../../src/catalog/infrastructure/dynamodb-product-repository';
import type { Database } from '../../src/platform/dynamodb';
import type { LocalizedText } from '../../src/shared-kernel/localized-text';

/** A product to seed: its slug, and whatever the test cares about; the rest gets a plain default. */
export type ProductSeed = Partial<Omit<ProductItem, 'pk' | 'sk' | 'listedAt' | 'variants'>> & {
  slug: string;
  listedAt?: Date;
  variants?: (Partial<VariantItem> & { priceYen?: number })[];
};

/**
 * Puts catalog data straight into a test's table, for tests that need a
 * catalog before the API can build one (the admin comes in a later ticket).
 * Tests still check results only through the API.
 */
export function catalogSeed(db: Database) {
  const documents = DynamoDBDocumentClient.from(db.client);
  const put = (items: (CategoryItem | ProductItem)[]) =>
    Promise.all(items.map((item) => documents.send(new PutCommand({ TableName: db.tableName, Item: item }))));

  return {
    /** Categories, each at its `position` in the owner's order. */
    categories(categories: { slug: string; name: LocalizedText; position: number }[]) {
      return put(
        categories.map(({ slug, name, position }): CategoryItem => ({ pk: 'CATEGORY', sk: slug, name, position })),
      );
    },

    /**
     * Products. By default each is listed, with a Japanese name and description
     * made from its slug, and one variant priced ¥10,000 with 5 in stock.
     */
    products(products: ProductSeed[]) {
      return put(products.map(productItem));
    },
  };
}

function productItem({ slug, listedAt, variants, ...product }: ProductSeed): ProductItem {
  const status = product.status ?? 'listed';
  return {
    pk: 'PRODUCT',
    sk: slug,
    status,
    name: { ja: slug },
    description: { ja: `${slug}の説明` },
    featured: false,
    ...product,
    listedAt: (listedAt ?? (status === 'listed' ? new Date('2026-09-01T10:00:00+09:00') : undefined))?.toISOString(),
    variants: (variants ?? [{}]).map((variant, index) => ({
      sku: `${slug}-${index + 1}`,
      label: { ja: `規格${index + 1}` },
      priceYen: 10_000,
      onHandStock: 5,
      reservedStock: 0,
      ...variant,
    })),
  };
}
