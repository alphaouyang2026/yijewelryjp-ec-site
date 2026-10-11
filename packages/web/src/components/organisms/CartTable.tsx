import type { CartLine, CartNotice } from '../../api';
import { formatYen } from '../../i18n/format';
import type { Messages } from '../../i18n/messages/ja';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { LocalizedLink } from '../atoms/LocalizedLink';
import { Photo } from '../atoms/Photo';
import { PhotoPlaceholder } from '../atoms/PhotoPlaceholder';
import { Price } from '../atoms/Price';
import { QuantityStepper } from '../molecules/QuantityStepper';
import styles from './CartTable.module.css';

/**
 * The cart's lines as the API checked them against the catalog: each with
 * its photo, name (a link to the product), size, unit price, quantity, line
 * total and the API's notices. A line that cannot be bought says it is not in
 * the total, and its quantity cannot be changed. Changes go to `onChangeQuantity`
 * and `onRemove`; while `busy`, nothing can be changed.
 */
export function CartTable({
  lines,
  busy,
  onChangeQuantity,
  onRemove,
}: {
  lines: CartLine[];
  busy: boolean;
  onChangeQuantity: (line: CartLine, quantity: number) => void;
  onRemove: (line: CartLine) => void;
}) {
  const text = useMessages();

  return (
    <ul aria-label={text.cart.lines} className={styles.lines}>
      {lines.map((line) => (
        <li key={line.lineId} className={[styles.line, line.available ? '' : styles.unavailable].join(' ')}>
          <div className={styles.photo}>
            {line.photo ? (
              <Photo src={line.photo.url} alt={line.photo.alt} shape="product" />
            ) : (
              <PhotoPlaceholder shape="product" />
            )}
          </div>
          <div className={styles.details}>
            <LocalizedLink to={paths.product(line.productSlug)} variant="card">
              <span className={styles.name}>{line.name}</span>
            </LocalizedLink>
            {line.variantLabel !== null && <p className={styles.variant}>{line.variantLabel}</p>}
            <Price amount={formatYen(line.priceYen)} taxNote={text.price.taxIncluded} />
            {line.notices.map((notice) => (
              <p key={notice.code} className={styles.notice}>
                {noticeText(notice, text.cart.notices)}
              </p>
            ))}
          </div>
          <div className={styles.controls}>
            <QuantityStepper
              value={line.quantity}
              max={line.maxQuantity}
              disabled={busy || !line.available}
              onChange={(quantity) => onChangeQuantity(line, quantity)}
            />
            <dl className={styles.lineTotal}>
              <dt className={styles.lineTotalTerm}>{text.cart.lineTotal}</dt>
              <dd className={line.available ? styles.lineTotalAmount : styles.notCounted}>
                {line.available ? formatYen(line.lineTotalYen) : text.cart.notCounted}
              </dd>
            </dl>
          </div>
          <div className={styles.remove}>
            <Button
              variant="icon"
              aria-label={text.cart.remove(text.cart.item(line.name, line.variantLabel))}
              disabled={busy}
              onClick={() => onRemove(line)}
            >
              <Icon name="close" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A cart notice in words, with its price formatted as the site writes amounts. */
function noticeText(notice: CartNotice, text: Messages['cart']['notices']): string {
  switch (notice.code) {
    case 'unlisted':
      return text.unlisted;
    case 'sold_out':
      return text.sold_out;
    case 'quantity_reduced':
      return text.quantity_reduced(notice.requestedQuantity);
    case 'price_changed':
      return text.price_changed(formatYen(notice.previousPriceYen));
  }
}
