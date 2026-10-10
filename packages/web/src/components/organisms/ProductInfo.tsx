import { useState } from 'react';
import type { ProductDetail } from '../../api';
import { formatYen } from '../../i18n/format';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { LocalizedLink } from '../atoms/LocalizedLink';
import { Price } from '../atoms/Price';
import { StockBadge } from '../atoms/StockBadge';
import { DetailList } from '../molecules/DetailList';
import { VariantChoice } from '../molecules/VariantChoice';
import styles from './ProductInfo.module.css';

/**
 * A product page's text side: category, name, the chosen size's price and
 * stock, the size choice, description and details. The first size in stock is
 * chosen at first; when every size is sold out, none is, and the product shows
 * SOLD OUT. Render it with `key={product.slug}` so another product starts afresh.
 */
export function ProductInfo({ product }: { product: ProductDetail }) {
  const text = useMessages();
  const [chosenSku, setChosenSku] = useState(
    () => product.variants.find((variant) => variant.stockStatus !== 'sold_out')?.sku,
  );
  const chosen = product.variants.find((variant) => variant.sku === chosenSku);
  const shown = chosen ?? product.variants[0];

  return (
    <div className={styles.info}>
      {product.category && (
        <LocalizedLink to={paths.category(product.category.slug)} variant="category">
          {product.category.name}
        </LocalizedLink>
      )}
      <h1 className={styles.name}>{product.name}</h1>
      {shown && <Price amount={formatYen(shown.priceYen)} taxNote={text.price.taxIncluded} size="detail" />}
      <div>
        {chosen ? (
          <StockBadge status={chosen.stockStatus} text={text.stockStatus[chosen.stockStatus]} />
        ) : (
          <StockBadge status="sold_out" text={text.stockStatus.sold_out} />
        )}
      </div>
      <VariantChoice variants={product.variants} chosen={chosenSku} onChoose={setChosenSku} />
      <p className={styles.description}>{product.description}</p>
      <DetailList
        details={[
          { term: text.productDetails.materials, value: product.materials },
          { term: text.productDetails.dimensions, value: product.dimensions },
          { term: text.productDetails.weight, value: product.weight },
          { term: text.productDetails.care, value: product.care },
        ]}
      />
    </div>
  );
}
