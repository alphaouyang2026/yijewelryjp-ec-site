import { useLoaderData } from 'react-router';
import { PhotoPlaceholder } from '../../atoms/PhotoPlaceholder';
import { ProductInfo } from '../../organisms/ProductInfo';
import { StoreLayout } from '../../templates/StoreLayout';
import styles from './ProductDetailPage.module.css';
import type { productLoader } from './productLoader';

/** A product's page: its photo beside its information. Photos come with the photo upload ticket; a placeholder until then. */
export function ProductDetailPage() {
  const { categories, product } = useLoaderData<typeof productLoader>();

  return (
    <StoreLayout categories={categories}>
      <div className={styles.page}>
        <div className={styles.photo}>
          <PhotoPlaceholder shape="product" />
        </div>
        <ProductInfo key={product.slug} product={product} />
      </div>
    </StoreLayout>
  );
}
