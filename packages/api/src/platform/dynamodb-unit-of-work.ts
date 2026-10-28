import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand, type TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import type { StartUnitOfWork, UnitOfWork } from '../shared-kernel/unit-of-work';
import type { Database } from './dynamodb';

/** One write of a transaction, as the document client takes it (Put, Update, ConditionCheck or Delete). */
export type TransactionWrite = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

/** A transaction holds at most this many writes (DynamoDB's limit for TransactWriteItems). */
const MAX_WRITES = 100;

/** A unit of work on the table: its writes, committed in one TransactWriteItems. */
class DynamoDbUnitOfWork implements UnitOfWork {
  readonly writes: TransactionWrite[] = [];

  constructor(private readonly db: Database) {}

  async commit(): Promise<'committed' | 'conflict'> {
    if (this.writes.length === 0) return 'committed';
    if (this.writes.length > MAX_WRITES) throw new Error(`A unit of work has at most ${MAX_WRITES} writes`);
    try {
      await DynamoDBDocumentClient.from(this.db.client).send(new TransactWriteCommand({ TransactItems: this.writes }));
      return 'committed';
    } catch (error) {
      if (isConflict(error)) return 'conflict';
      throw error;
    }
  }
}

/** Units of work on the API's single table. */
export function dynamoDbUnitsOfWork(db: Database): StartUnitOfWork {
  return () => new DynamoDbUnitOfWork(db);
}

/**
 * Adds `write` to `unit`, which must have been started on the table; the
 * infrastructure layers of the contexts add their writes this way.
 */
export function addWrite(unit: UnitOfWork, write: TransactionWrite) {
  if (!(unit instanceof DynamoDbUnitOfWork)) throw new Error('The unit of work is not on the DynamoDB table');
  unit.writes.push(write);
}

/**
 * Whether the transaction was cancelled because a write's condition failed,
 * or because another transaction was writing one of its items at that moment.
 */
function isConflict(error: unknown): boolean {
  return (
    error instanceof TransactionCanceledException &&
    (error.CancellationReasons ?? []).some(
      (reason) => reason.Code === 'ConditionalCheckFailed' || reason.Code === 'TransactionConflict',
    )
  );
}
