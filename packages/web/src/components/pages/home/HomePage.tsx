import { useId } from 'react';
import { useLoaderData } from 'react-router';
import { useMessages } from '../../../i18n/useMessages';
import { paths } from '../../../paths';
import { LocalizedLink } from '../../atoms/LocalizedLink';
import { SectionHeading } from '../../molecules/SectionHeading';
import { CategoryGrid } from '../../organisms/CategoryGrid';
import { FeaturedProduct } from '../../organisms/FeaturedProduct';
import { HeroSection } from '../../organisms/HeroSection';
import { ProductGrid } from '../../organisms/ProductGrid';
import { ServiceInfo } from '../../organisms/ServiceInfo';
import { StoreLayout } from '../../templates/StoreLayout';
import styles from './HomePage.module.css';
import type { homeLoader } from './homeLoader';

/** The home page (spec #1 首页结构): main visual, new arrivals, the featured product, categories, service info. */
export function HomePage() {
  const { categories, newArrivals, featured } = useLoaderData<typeof homeLoader>();
  const text = useMessages().home;
  const newArrivalsHeadingId = useId();

  return (
    <StoreLayout categories={categories}>
      <HeroSection />
      <section aria-labelledby={newArrivalsHeadingId} className={styles.section}>
        <SectionHeading id={newArrivalsHeadingId} label={text.newArrivalsLabel} title={text.newArrivalsTitle} />
        <ProductGrid products={newArrivals} emptyText={text.noNewArrivals} headingLevel={3} />
        {newArrivals.length > 0 && (
          <div className={styles.more}>
            <LocalizedLink to={paths.products} variant="buttonOutline">
              {text.allNewArrivals}
            </LocalizedLink>
          </div>
        )}
      </section>
      {featured && <FeaturedProduct product={featured} />}
      {categories.length > 0 && <CategoryGrid categories={categories} />}
      <ServiceInfo />
    </StoreLayout>
  );
}
