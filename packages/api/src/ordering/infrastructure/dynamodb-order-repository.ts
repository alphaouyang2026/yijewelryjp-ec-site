import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { withoutUndefined, type Database } from '../../platform/dynamodb';
import { addWrite } from '../../platform/dynamodb-unit-of-work';
import type { Locale } from '../../shared-kernel/locale';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import { yen } from '../../shared-kernel/money';
import type { Customer, Order, OrderEmail, OrderRepository, OrderStatus } from '../domain/order';

/**
 * An order's item: every order in partition ORDER, keyed by its number, which
 * sorts by when it was placed (see docs/adr/0008-orders-and-checkout.md).
 */
export type OrderItem = {
  pk: 'ORDER';
  sk: string; // the order number
  status: OrderStatus;
  locale: Locale;
  lines: OrderLineItem[];
  subtotalYen: number;
  shippingYen: number;
  totalYen: number;
  placedAt: string; // ISO 8601
  checkoutToken: string;
  checkoutSessionId?: string;
  /** Once paid: the customer as they gave their details on the payment page. */
  customer?: Customer;
  paidAt?: string; // ISO 8601
  /** Missing on orders placed before emails were sent: none was. */
  sentEmails?: OrderEmail[];
  /** 1 when created, one more with each write; every change is conditional on the version it read. */
  version: number;
};

export type OrderLineItem = {
  productSlug: string;
  sku: string;
  productName: LocalizedText;
  variantLabel: LocalizedText;
  unitPriceYen: number;
  quantity: number;
};

const PARTITION = 'ORDER';

export function dynamoDbOrderRepository(db: Database): OrderRepository {
  const documents = DynamoDBDocumentClient.from(db.client);
  /** The write of `order` as the next version, if the stored order is still at `order.version`. */
  const nextVersion = (order: Order) => ({
    TableName: db.tableName,
    Item: toItem({ ...order, version: order.version + 1 }),
    ConditionExpression: 'version = :read',
    ExpressionAttributeValues: { ':read': order.version },
  });

  return {
    async byId(id) {
      const { Item } = await documents.send(
        new GetCommand({ TableName: db.tableName, Key: { pk: PARTITION, sk: id } }),
      );
      return Item ? toOrder(Item as OrderItem) : undefined;
    },

    addIn(unit, order) {
      addWrite(unit, {
        Put: { TableName: db.tableName, Item: toItem(order), ConditionExpression: 'attribute_not_exists(pk)' },
      });
    },

    updateIn(unit, order) {
      addWrite(unit, { Put: nextVersion(order) });
    },

    async update(order) {
      try {
        const write = nextVersion(order);
        await documents.send(new PutCommand(write));
        return { ...order, version: write.Item.version };
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) return 'stale';
        throw error;
      }
    },
  };
}

function toOrder(item: OrderItem): Order {
  return {
    id: item.sk,
    status: item.status,
    locale: item.locale,
    lines: item.lines.map((line) => ({
      productSlug: line.productSlug,
      sku: line.sku,
      productName: line.productName,
      variantLabel: line.variantLabel,
      unitPrice: yen(line.unitPriceYen),
      quantity: line.quantity,
    })),
    subtotal: yen(item.subtotalYen),
    shipping: yen(item.shippingYen),
    total: yen(item.totalYen),
    placedAt: new Date(item.placedAt),
    checkoutToken: item.checkoutToken,
    checkoutSessionId: item.checkoutSessionId,
    customer: item.customer,
    paidAt: item.paidAt === undefined ? undefined : new Date(item.paidAt),
    sentEmails: item.sentEmails ?? [],
    version: item.version,
  };
}

function toItem(order: Order): OrderItem {
  return withoutUndefined({
    pk: PARTITION,
    sk: order.id,
    status: order.status,
    locale: order.locale,
    lines: order.lines.map((line) => ({
      productSlug: line.productSlug,
      sku: line.sku,
      productName: line.productName,
      variantLabel: line.variantLabel,
      unitPriceYen: line.unitPrice.yen,
      quantity: line.quantity,
    })),
    subtotalYen: order.subtotal.yen,
    shippingYen: order.shipping.yen,
    totalYen: order.total.yen,
    placedAt: order.placedAt.toISOString(),
    checkoutToken: order.checkoutToken,
    checkoutSessionId: order.checkoutSessionId,
    customer: order.customer,
    paidAt: order.paidAt?.toISOString(),
    sentEmails: [...order.sentEmails],
    version: order.version,
  });
}
