import type { Locale } from '../../shared-kernel/locale';
import { textIn } from '../../shared-kernel/localized-text';
import type { Money } from '../../shared-kernel/money';
import type { Email } from '../domain/mailer';
import { lineAmount, taxIncluded, type Customer, type Order, type ShippingAddress } from '../domain/order';
import { renderEmail, STORE_NAME, type EmailParagraph, type EmailSection } from './email-document';

/** The texts of the order confirmation in each locale. */
type ConfirmationTexts = {
  subject(orderNumber: string): string;
  greeting(name: string): string;
  intro: string[];
  orderNumber(orderNumber: string): string;
  items: string;
  lineName(name: string, variant: string): string;
  subtotal(amount: string): string;
  shipping(amount: string): string;
  total(amount: string, tax: string): string;
  shippingAddress: string;
  recipient(name: string): string;
  orderPage: string;
  orderPageIntro: string;
  closing: string[];
};

const CONFIRMATION_TEXTS: Record<Locale, ConfirmationTexts> = {
  ja: {
    subject: (number) => `【${STORE_NAME}】ご注文ありがとうございます（ご注文番号 ${number}）`,
    greeting: (name) => `${name} 様`,
    intro: [`このたびは ${STORE_NAME} をご利用いただき、誠にありがとうございます。`, '以下の内容でご注文を承りました。'],
    orderNumber: (number) => `ご注文番号：${number}`,
    items: 'ご注文内容',
    lineName: (name, variant) => (variant ? `${name}（${variant}）` : name),
    subtotal: (amount) => `小計：${amount}`,
    shipping: (amount) => `送料：${amount}`,
    total: (amount, tax) => `合計：${amount}（うち消費税 ${tax}）`,
    shippingAddress: 'お届け先',
    recipient: (name) => `${name} 様`,
    orderPage: 'ご注文状況',
    orderPageIntro: 'ご注文の状況は、下記のページからいつでもご確認いただけます。',
    closing: ['商品を発送しましたら、あらためてメールでお知らせいたします。', 'ご不明な点がございましたら、このメールにご返信ください。'],
  },
  zh: {
    subject: (number) => `【${STORE_NAME}】感谢您的订购（订单号 ${number}）`,
    greeting: (name) => `${name} 您好：`,
    intro: [`感谢您在 ${STORE_NAME} 购物。`, '我们已收到您的以下订单。'],
    orderNumber: (number) => `订单号：${number}`,
    items: '订单内容',
    lineName: (name, variant) => (variant ? `${name}（${variant}）` : name),
    subtotal: (amount) => `小计：${amount}`,
    shipping: (amount) => `运费：${amount}`,
    total: (amount, tax) => `合计：${amount}（含消费税 ${tax}）`,
    shippingAddress: '收货地址',
    recipient: (name) => name,
    orderPage: '订单状态',
    orderPageIntro: '您可以随时通过以下页面查看订单状态。',
    closing: ['商品发货时，我们会再发邮件通知您。', '如有任何疑问，请直接回复此邮件。'],
  },
  en: {
    subject: (number) => `[${STORE_NAME}] Thank you for your order (Order ${number})`,
    greeting: (name) => `Dear ${name},`,
    intro: [`Thank you for shopping at ${STORE_NAME}.`, 'We have received your order as follows.'],
    orderNumber: (number) => `Order number: ${number}`,
    items: 'Your order',
    lineName: (name, variant) => (variant ? `${name} (${variant})` : name),
    subtotal: (amount) => `Subtotal: ${amount}`,
    shipping: (amount) => `Shipping: ${amount}`,
    total: (amount, tax) => `Total: ${amount} (including ${tax} consumption tax)`,
    shippingAddress: 'Shipping address',
    recipient: (name) => name,
    orderPage: 'Order status',
    orderPageIntro: 'You can check the status of your order at any time on this page:',
    closing: ['We will email you again when your order ships.', 'If you have any questions, just reply to this email.'],
  },
};

/**
 * The order confirmation the customer gets once they have paid, in the
 * locale they ordered in: the order's lines, amounts and the tax included,
 * where it ships, and the link to the order page (`orderPageUrl`).
 */
export function orderConfirmationEmail(order: Order, customer: Customer, orderPageUrl: string): Email {
  const texts = CONFIRMATION_TEXTS[order.locale];
  const { name } = customer.shippingAddress;
  const sections: EmailSection[] = [
    { paragraphs: [[texts.greeting(name)], texts.intro, [texts.orderNumber(order.id)]] },
    { heading: texts.items, paragraphs: itemParagraphs(order, order.locale) },
    { heading: texts.shippingAddress, paragraphs: [addressLines(customer, order.locale)] },
    { heading: texts.orderPage, paragraphs: [[texts.orderPageIntro], { link: orderPageUrl }] },
    { paragraphs: [texts.closing, [STORE_NAME]] },
  ];
  return renderEmail({ to: customer.email, subject: texts.subject(order.id), sections });
}

/**
 * The new order notice the owner gets once the customer has paid, in
 * Japanese (the owner's notice locale is a store setting to come, #16): the
 * order, the customer's contact details and where it ships.
 */
export function newOrderNoticeEmail(order: Order, customer: Customer, to: string): Email {
  const texts = CONFIRMATION_TEXTS.ja;
  const sections: EmailSection[] = [
    {
      paragraphs: [
        ['新しいご注文のお支払いが完了しました。発送の準備をお願いします。'],
        [texts.orderNumber(order.id), `お客様の言語：${LOCALE_NAMES_JA[order.locale]}`],
      ],
    },
    { heading: texts.items, paragraphs: itemParagraphs(order, 'ja') },
    { heading: texts.shippingAddress, paragraphs: [addressLines(customer, 'ja')] },
    { heading: 'お客様の連絡先', paragraphs: [[customer.email, ...(customer.phone ? [customer.phone] : [])]] },
  ];
  return renderEmail({
    to,
    subject: `【新規注文】ご注文番号 ${order.id}（合計 ${formatYen(order.total)}）`,
    sections,
  });
}

/** Each locale's name, in Japanese. */
const LOCALE_NAMES_JA: Record<Locale, string> = { ja: '日本語', zh: '中国語', en: '英語' };

/** The order's lines, then its amounts and the tax included, in `locale`. */
function itemParagraphs(order: Order, locale: Locale): EmailParagraph[] {
  const texts = CONFIRMATION_TEXTS[locale];
  return [
    ...order.lines.map((line) => [
      texts.lineName(textIn(line.productName, locale), textIn(line.variantLabel, locale)),
      `${formatYen(line.unitPrice)} × ${line.quantity} = ${formatYen(lineAmount(line))}`,
    ]),
    [
      texts.subtotal(formatYen(order.subtotal)),
      texts.shipping(formatYen(order.shipping)),
      texts.total(formatYen(order.total), formatYen(taxIncluded(order.total))),
    ],
  ];
}

/** The address as a Japanese label has it: postal code, the address, the recipient, and their phone. */
function addressLines(customer: Customer, locale: Locale): EmailParagraph {
  const address: ShippingAddress = customer.shippingAddress;
  return [
    `〒${address.postalCode}`,
    `${address.prefecture}${address.city}${address.line1}${address.line2 ? ` ${address.line2}` : ''}`,
    CONFIRMATION_TEXTS[locale].recipient(address.name),
    ...(customer.phone ? [customer.phone] : []),
  ];
}

/** An amount as the store shows it in every locale: ¥ and the yen with thousands separators. */
function formatYen(amount: Money): string {
  return `¥${amount.yen.toLocaleString('ja-JP')}`;
}
