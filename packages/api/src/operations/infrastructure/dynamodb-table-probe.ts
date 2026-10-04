import { checkTable, type Database } from '../../platform/dynamodb';
import type { DatabaseProbe } from '../domain/database-probe';

export function dynamoDbTableProbe(db: Database): DatabaseProbe {
  return { check: () => checkTable(db) };
}
