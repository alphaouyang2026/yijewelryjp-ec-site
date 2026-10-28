import type { AppDeps } from './app';
import { dynamoDbCategoryRepository } from './catalog/infrastructure/dynamodb-category-repository';
import { dynamoDbProductRepository } from './catalog/infrastructure/dynamodb-product-repository';
import { dynamoDbTableProbe } from './operations/infrastructure/dynamodb-table-probe';
import { dynamoDbOrderRepository } from './ordering/infrastructure/dynamodb-order-repository';
import type { Database } from './platform/dynamodb';
import { dynamoDbUnitsOfWork } from './platform/dynamodb-unit-of-work';

/**
 * Every adapter backed by the single DynamoDB table. Repositories have only
 * this implementation: tests run it against DynamoDB Local.
 */
export function dynamoDbAdapters(db: Database): Pick<
  AppDeps,
  'categories' | 'products' | 'orders' | 'startUnitOfWork' | 'databaseProbe'
> {
  return {
    categories: dynamoDbCategoryRepository(db),
    products: dynamoDbProductRepository(db),
    orders: dynamoDbOrderRepository(db),
    startUnitOfWork: dynamoDbUnitsOfWork(db),
    databaseProbe: dynamoDbTableProbe(db),
  };
}
