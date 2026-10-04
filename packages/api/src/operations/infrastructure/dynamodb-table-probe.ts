import { checkTable, type Database } from '../../platform/dynamodb';
import type { DatabaseProbe } from '../application/check-health';

export function dynamoDbTableProbe(db: Database): DatabaseProbe {
  return { check: () => checkTable(db) };
}
