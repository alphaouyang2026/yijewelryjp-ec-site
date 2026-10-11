import { ConditionalCheckFailedException, TransactionCanceledException } from '@aws-sdk/client-dynamodb';

// Every product and category item carries a version, and every write to one
// is conditional on the version the owner's change was made from (see
// docs/adr/0005-catalog-data-layout.md). Items written before versions
// existed have none: they read as version 0, and a write made from version 0
// may replace them.

/** The version of an item as stored: 0 for an item written before items had versions. */
export const storedVersion = (item: { version?: number }): number => item.version ?? 0;

/**
 * The condition, and its values, for writing an item that exists and is
 * still at version `read` (or has no version, as at version 0). Other names
 * and values of the write go alongside.
 */
export function onVersion(read: number) {
  return {
    ConditionExpression: 'attribute_exists(pk) AND (attribute_not_exists(version) OR version = :read)',
    ExpressionAttributeValues: { ':read': read },
  };
}

/** Whether a write, or a transaction of writes, failed because an item was not at the version its write required. */
export function isStaleWrite(error: unknown): boolean {
  return (
    error instanceof ConditionalCheckFailedException ||
    (error instanceof TransactionCanceledException &&
      (error.CancellationReasons ?? []).some((reason) => reason.Code === 'ConditionalCheckFailed'))
  );
}
