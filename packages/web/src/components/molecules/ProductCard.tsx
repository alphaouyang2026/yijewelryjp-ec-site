import type { ProductSummary } from '../../api';
import { formatYen } from '../../i18n/format';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { LocalizedLink } from '../atoms/LocalizedLink';
import { PhotoPlaceholder } from '../atoms/PhotoPlaceholder';
import { Price } from '../atoms/Price';
import { StockBadge } from '../atoms/StockBadge';
import styles from './ProductCard.module.css';

/**
 * A product in a grid, linking to its page: photo, name, lowest price (marked
 * as a starting price when its sizes cost different amounts) and, when it is
 * low or sold out, its stock status. `headingLevel` fits the page's outline.
 */
export function ProductCard({ product, headingLevel }: { product: ProductSummary; headingLevel: 2 | 3 }) {
  const text = useMessages();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const amount = formatYen(product.priceYen);

  return (
    <LocalizedLink to={paths.product(product.slug)} variant="card">
      <div className={styles.photo}>
        <PhotoPlaceholder shape="product" />
        {product.stockStatus !== 'in_stock' && (
          <span className={styles.badge}>
            <StockBadge status={product.stockStatus} text={text.stockStatus[product.stockStatus]} />
          </span>
        )}
      </div>
      <Heading className={styles.name}>{product.name}</Heading>
      <Price amount={product.priceVaries ? text.price.from(amount) : amount} taxNote={text.price.taxIncluded} />
    </LocalizedLink>
  );
}
