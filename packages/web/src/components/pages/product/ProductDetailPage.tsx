import { useState } from 'react';
import { useLoaderData } from 'react-router';
import { api } from '../../../api';
import { useLocale } from '../../../i18n/useLocale';
import { PhotoGallery } from '../../organisms/PhotoGallery';
import { ProductInfo, type AddToCartResult } from '../../organisms/ProductInfo';
import { StoreLayout } from '../../templates/StoreLayout';
import { useCartQuantity } from '../store/storeFrame';
import { useCartChange } from '../store/useCartChange';
import styles from './ProductDetailPage.module.css';
import type { productLoader } from './productLoader';

/**
 * A product's page: its photos beside its information, from which the chosen
 * size goes into the cart. Once the API has answered, the page's data is
 * reloaded: the header's count follows the cart, and the sizes' stock the
 * catalog (a refusal may mean the size has just sold out).
 */
export function ProductDetailPage() {
  const { categories, product } = useLoaderData<typeof productLoader>();
  const locale = useLocale();
  const { busy: adding, send } = useCartChange();
  const [addResult, setAddResult] = useState<{ slug: string; result: AddToCartResult } | null>(null);

  async function addToCart(sku: string, quantity: number) {
    const slug = product.slug;
    setAddResult(null);
    const result = await send<AddToCartResult>(
      async () => {
        const res = await api.cart.lines.$post({ query: { locale }, json: { productSlug: slug, sku, quantity } });
        if (res.ok) return { answered: true, result: { outcome: 'added' } };
        if (res.status === 409) return { answered: true, result: { outcome: 'refused', refusal: await res.json() } };
        return { answered: false, result: { outcome: 'failed' } };
      },
      { outcome: 'failed' },
    );
    setAddResult({ slug, result });
  }

  return (
    <StoreLayout categories={categories} cartQuantity={useCartQuantity()}>
      <div className={styles.page}>
        <div className={styles.photo}>
          <PhotoGallery key={product.slug} photos={product.photos} />
        </div>
        <ProductInfo
          key={product.slug}
          product={product}
          onAddToCart={addToCart}
          adding={adding}
          addResult={addResult?.slug === product.slug ? addResult.result : null}
        />
      </div>
    </StoreLayout>
  );
}
