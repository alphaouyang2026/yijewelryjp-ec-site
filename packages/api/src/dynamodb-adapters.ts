import type { AppDeps } from './app';
import { dynamoDbCategoryRepository } from './catalog/infrastructure/dynamodb-category-repository';
import { dynamoDbProductRepository } from './catalog/infrastructure/dynamodb-product-repository';
import { dynamoDbTableProbe } from './operations/infrastructure/dynamodb-table-probe';
import type { Database } from './platform/dynamodb';

/**
 * Every adapter backed by the single DynamoDB table. Repositories have only
 * this implementation: tests run it against DynamoDB Local.
 */
export function dynamoDbAdapters(db: Database): Omit<AppDeps, 'clock'> {
  return {
    categories: dynamoDbCategoryRepository(db),
    products: dynamoDbProductRepository(db),
    databaseProbe: dynamoDbTableProbe(db),
  };
}
