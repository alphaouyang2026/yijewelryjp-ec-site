import { useId } from 'react';
import type { FeaturedProduct as Featured } from '../../api';
import { formatYen } from '../../i18n/format';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { Label } from '../atoms/Label';
import { LocalizedLink } from '../atoms/LocalizedLink';
import { PhotoPlaceholder } from '../atoms/PhotoPlaceholder';
import { Price } from '../atoms/Price';
import { DetailList } from '../molecules/DetailList';
import styles from './FeaturedProduct.module.css';

/** The product the owner picked for the home page (dark area): photo, name, description, materials, sizes, price, and a link to its page. */
export function FeaturedProduct({ product }: { product: Featured }) {
  const text = useMessages();
  const nameId = useId();
  const amount = formatYen(product.priceYen);

  return (
    <section aria-labelledby={nameId} className={styles.band}>
      <div className={styles.inner}>
        <div className={styles.photo}>
          <PhotoPlaceholder shape="product" ground="dark" />
        </div>
        <div className={styles.copy}>
          <Label ground="dark">{text.home.featuredLabel}</Label>
          <h2 id={nameId} className={styles.name}>
            {product.name}
          </h2>
          <p className={styles.description}>{product.description}</p>
          <DetailList
            ground="dark"
            details={[
              { term: text.productDetails.materials, value: product.materials },
              { term: text.productDetails.sizes, value: product.variantLabels.join(' / ') || null },
              {
                term: text.productDetails.price,
                value: (
                  <Price
                    amount={product.priceVaries ? text.price.from(amount) : amount}
                    taxNote={text.price.taxIncluded}
                    ground="dark"
                  />
                ),
              },
            ]}
          />
          <div>
            <LocalizedLink to={paths.product(product.slug)} variant="buttonGoldOutline">
              {text.home.featuredCta}
            </LocalizedLink>
          </div>
        </div>
      </div>
    </section>
  );
}
