import { useLoaderData } from 'react-router';
import { useMessages } from '../../../i18n/useMessages';
import { SectionHeading } from '../../molecules/SectionHeading';
import { SortOptions } from '../../molecules/SortOptions';
import { ProductGrid } from '../../organisms/ProductGrid';
import { StoreLayout } from '../../templates/StoreLayout';
import styles from './ProductListPage.module.css';
import type { productListLoader } from './productListLoader';

/** Every listed product, or one category's, with the sort options. */
export function ProductListPage() {
  const { list, sort, category } = useLoaderData<typeof productListLoader>();
  const text = useMessages().productList;

  return (
    <StoreLayout categories={list.categories}>
      <div className={styles.page}>
        <SectionHeading
          level={1}
          label={list.category ? text.categoryLabel : text.allLabel}
          title={list.category?.name ?? text.allTitle}
        />
        <SortOptions category={category} current={sort} />
        <ProductGrid products={list.products} emptyText={text.empty} headingLevel={2} />
      </div>
    </StoreLayout>
  );
}
