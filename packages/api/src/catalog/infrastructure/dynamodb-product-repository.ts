import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { queryPartition, withoutUndefined, type Database } from '../../platform/dynamodb';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import { yen } from '../../shared-kernel/money';
import {
  productTexts,
  type Product,
  type ProductRepository,
  type ProductStatus,
  type ProductTexts,
} from '../domain/product';
import { isStaleWrite, onVersion, storedVersion } from './versioned-writes';

/**
 * A product's item: every product in partition PRODUCT, keyed by its slug, with
 * its variants and their stock inside it. The whole catalog is one partition,
 * read whole for every list (see docs/adr/0005-catalog-data-layout.md).
 */
export type ProductItem = ProductTexts & {
  pk: 'PRODUCT';
  sk: string; // the slug
  status: ProductStatus;
  categorySlug?: string;
  featured: boolean;
  listedAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
  variants: VariantItem[];
  /**
   * 1 when created, one more with each write; every write is conditional on
   * the version it read. Absent from items written before items had versions.
   */
  version?: number;
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

    async add(product) {
      try {
        await documents.send(
          new PutCommand({
            TableName: db.tableName,
            Item: toItem(product),
            ConditionExpression: 'attribute_not_exists(pk)',
          }),
        );
        return 'added';
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) return 'slug_taken';
        throw error;
      }
    },

    async update(product) {
      const stored = { ...product, version: product.version + 1 };
      try {
        await documents.send(
          new PutCommand({
            TableName: db.tableName,
            Item: toItem(stored),
            ...onVersion(product.version),
          }),
        );
        return stored;
      } catch (error) {
        if (isStaleWrite(error)) return 'stale';
        throw error;
      }
    },
  };
}

function toProduct(item: ProductItem): Product {
  return {
    slug: item.sk,
    status: item.status,
    ...productTexts(item),
    categorySlug: item.categorySlug,
    featured: item.featured,
    listedAt: item.listedAt ? new Date(item.listedAt) : undefined,
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
    variants: item.variants.map((variant) => ({
      sku: variant.sku,
      label: variant.label,
      price: yen(variant.priceYen),
      onHandStock: variant.onHandStock,
      reservedStock: variant.reservedStock,
    })),
    version: storedVersion(item),
  };
}

/** The product's item; details the product does not have are left out. */
function toItem(product: Product): ProductItem {
  return withoutUndefined({
    pk: PARTITION,
    sk: product.slug,
    status: product.status,
    ...productTexts(product),
    categorySlug: product.categorySlug,
    featured: product.featured,
    listedAt: product.listedAt?.toISOString(),
    updatedAt: product.updatedAt?.toISOString(),
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      label: variant.label,
      priceYen: variant.price.yen,
      onHandStock: variant.onHandStock,
      reservedStock: variant.reservedStock,
    })),
    version: product.version,
  });
}
