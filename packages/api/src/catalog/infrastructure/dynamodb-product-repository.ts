import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { queryPartition, type Database } from '../../platform/dynamodb';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import { yen } from '../../shared-kernel/money';
import type { Product, ProductRepository, ProductStatus } from '../domain/product';

/**
 * A product's item: every product in partition PRODUCT, keyed by its slug, with
 * its variants and their stock inside it. The whole catalog is one partition,
 * read whole for every list (see docs/adr/0005-catalog-data-layout.md).
 */
export type ProductItem = {
  pk: 'PRODUCT';
  sk: string; // the slug
  status: ProductStatus;
  name: LocalizedText;
  description: LocalizedText;
  materials?: LocalizedText;
  dimensions?: LocalizedText;
  weight?: LocalizedText;
  care?: LocalizedText;
  categorySlug?: string;
  featured: boolean;
  listedAt?: string; // ISO 8601
  variants: VariantItem[];
};

export type VariantItem = {
  sku: string;
  label: LocalizedText;
  priceYen: number;
  onHandStock: number;
  reservedStock: number;
};

const PARTITION = 'PRODUCT';

export function dynamoDbProductRepository(db: Database): ProductRepository {
  const documents = DynamoDBDocumentClient.from(db.client);
  return {
    async all() {
      const items = await queryPartition<ProductItem>(db, PARTITION);
      return items.map(toProduct);
    },

    async bySlug(slug) {
      const { Item } = await documents.send(
        new GetCommand({ TableName: db.tableName, Key: { pk: PARTITION, sk: slug } }),
      );
      return Item ? toProduct(Item as ProductItem) : undefined;
    },
  };
}

function toProduct(item: ProductItem): Product {
  return {
    slug: item.sk,
    status: item.status,
    name: item.name,
    description: item.description,
    materials: item.materials,
    dimensions: item.dimensions,
    weight: item.weight,
    care: item.care,
    categorySlug: item.categorySlug,
    featured: item.featured,
    listedAt: item.listedAt ? new Date(item.listedAt) : undefined,
    variants: item.variants.map((variant) => ({
      sku: variant.sku,
      label: variant.label,
      price: yen(variant.priceYen),
      onHandStock: variant.onHandStock,
      reservedStock: variant.reservedStock,
    })),
  };
}
