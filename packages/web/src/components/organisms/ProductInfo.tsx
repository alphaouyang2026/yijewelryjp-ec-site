import { useState } from 'react';
import type { CartAddRefusal, ProductDetail } from '../../api';
import { formatYen } from '../../i18n/format';
import type { Messages } from '../../i18n/messages/ja';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { Button } from '../atoms/Button';
import { LocalizedLink } from '../atoms/LocalizedLink';
import { Notice } from '../atoms/Notice';
import { Price } from '../atoms/Price';
import { StockBadge } from '../atoms/StockBadge';
import { DetailList } from '../molecules/DetailList';
import { QuantityStepper } from '../molecules/QuantityStepper';
import { VariantChoice } from '../molecules/VariantChoice';
import styles from './ProductInfo.module.css';

/** How adding to the cart ended: added, refused by the API, or failed (the API did not answer, or did not know the size). */
export type AddToCartResult = { outcome: 'added' } | { outcome: 'refused'; refusal: CartAddRefusal } | { outcome: 'failed' };

/**
 * A product page's text side: category, name, the chosen size's price and
 * stock, the size choice, the quantity and the button that adds them to the
 * cart, description and details. The first size in stock is chosen at first;
 * when every size is sold out, none is, the product shows SOLD OUT and cannot
 * be added. `onAddToCart` adds the chosen size; `adding` is true until
 * `addResult` says how that ended. Render it with `key={product.slug}` so
 * another product starts afresh.
 */
export function ProductInfo({
  product,
  onAddToCart,
  adding,
  addResult,
}: {
  product: ProductDetail;
  onAddToCart: (sku: string, quantity: number) => void;
  adding: boolean;
  addResult: AddToCartResult | null;
}) {
  const text = useMessages();
  const [chosenSku, setChosenSku] = useState(
    () => product.variants.find((variant) => variant.stockStatus !== 'sold_out')?.sku,
  );
  const [quantity, setQuantity] = useState(1);
  const chosen = product.variants.find((variant) => variant.sku === chosenSku);
  const shown = chosen ?? product.variants[0];
  const canAdd = chosen !== undefined && chosen.stockStatus !== 'sold_out';

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
      <div className={styles.purchase}>
        <QuantityStepper value={quantity} onChange={setQuantity} disabled={!canAdd} />
        <Button
          variant="primary"
          className={styles.addToCart}
          disabled={!canAdd || adding}
          onClick={() => chosen && onAddToCart(chosen.sku, quantity)}
        >
          {text.productPage.addToCart}
        </Button>
      </div>
      {addResult && (
        <div className={styles.notice}>
          <AddToCartNotice result={addResult} />
        </div>
      )}
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

/** What adding to the cart came to: added, with a link to the cart, or why not. */
function AddToCartNotice({ result }: { result: AddToCartResult }) {
  const text = useMessages().productPage;
  if (result.outcome === 'added') {
    return (
      <Notice tone="done">
        {text.added}
        <LocalizedLink to={paths.cart} variant="category">
          {text.viewCart}
        </LocalizedLink>
      </Notice>
    );
  }
  return <Notice tone="problem">{result.outcome === 'refused' ? refusalText(result.refusal, text) : text.addFailed}</Notice>;
}

function refusalText(refusal: CartAddRefusal, text: Messages['productPage']): string {
  switch (refusal.error) {
    case 'sold_out':
      return text.soldOut;
    case 'exceeds_available':
      return text.exceedsAvailable(refusal.availableStock);
    case 'cart_full':
      return text.cartFull(refusal.maxLines);
  }
}
