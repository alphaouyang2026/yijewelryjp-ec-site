import { useId } from 'react';
import { useLoaderData } from 'react-router';
import { SectionHeading } from '../../molecules/SectionHeading';
import { StoreLayout } from '../../templates/StoreLayout';
import styles from './HomePage.module.css';
import type { homeLoader } from './homeLoader';

export function HomePage() {
  const { categories, newArrivals } = useLoaderData<typeof homeLoader>();
  const newArrivalsHeadingId = useId();

  return (
    <StoreLayout categories={categories}>
      <section aria-labelledby={newArrivalsHeadingId} className={styles.section}>
        <SectionHeading id={newArrivalsHeadingId} label="New Arrivals" title="新作" />
        {newArrivals.length === 0 && <p className={styles.empty}>ただいま新作を準備中です。</p>}
      </section>
    </StoreLayout>
  );
}
