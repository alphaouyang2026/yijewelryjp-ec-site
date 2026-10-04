import { useId } from 'react';
import { useLoaderData } from 'react-router';
import { SiteLayout } from '../../layout/SiteLayout';
import styles from './HomePage.module.css';
import type { homeLoader } from './homeLoader';

export function HomePage() {
  const { categories, newArrivals } = useLoaderData<typeof homeLoader>();
  const newArrivalsHeadingId = useId();

  return (
    <SiteLayout categories={categories}>
      <section aria-labelledby={newArrivalsHeadingId} className={styles.section}>
        <div className={styles.heading}>
          <p className={styles.label}>New Arrivals</p>
          <h2 id={newArrivalsHeadingId} className={styles.title}>
            新作
          </h2>
        </div>
        {newArrivals.length === 0 && <p className={styles.empty}>ただいま新作を準備中です。</p>}
      </section>
    </SiteLayout>
  );
}
