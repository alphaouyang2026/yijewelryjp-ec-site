import { useLoaderData } from 'react-router';
import { PhotoGallery } from '../../organisms/PhotoGallery';
import { ProductInfo } from '../../organisms/ProductInfo';
import { StoreLayout } from '../../templates/StoreLayout';
import styles from './ProductDetailPage.module.css';
import type { productLoader } from './productLoader';

/** A product's page: its photos beside its information. */
export function ProductDetailPage() {
  const { categories, product } = useLoaderData<typeof productLoader>();

  return (
    <StoreLayout categories={categories}>
      <div className={styles.page}>
        <div className={styles.photo}>
          <PhotoGallery key={product.slug} photos={product.photos} />
        </div>
        <ProductInfo key={product.slug} product={product} />
      </div>
    </StoreLayout>
  );
}
