import { useId } from 'react';
import { useLoaderData } from 'react-router';
import { useMessages } from '../../../i18n/useMessages';
import { SectionHeading } from '../../molecules/SectionHeading';
import { StoreLayout } from '../../templates/StoreLayout';
import styles from './HomePage.module.css';
import type { homeLoader } from './homeLoader';

export function HomePage() {
  const { categories, newArrivals } = useLoaderData<typeof homeLoader>();
  const text = useMessages().home;
  const newArrivalsHeadingId = useId();

  return (
    <StoreLayout categories={categories}>
      <section aria-labelledby={newArrivalsHeadingId} className={styles.section}>
        <SectionHeading id={newArrivalsHeadingId} label={text.newArrivalsLabel} title={text.newArrivalsTitle} />
        {newArrivals.length === 0 && <p className={styles.empty}>{text.noNewArrivals}</p>}
      </section>
    </StoreLayout>
  );
}
