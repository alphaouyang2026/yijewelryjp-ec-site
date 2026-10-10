import { useId } from 'react';
import type { Category } from '../../api';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { LocalizedLink } from '../atoms/LocalizedLink';
import { PhotoPlaceholder } from '../atoms/PhotoPlaceholder';
import { SectionHeading } from '../molecules/SectionHeading';
import styles from './CategoryGrid.module.css';

/** The categories as a grid of links to their product lists (light area). */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  const text = useMessages().home;
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <SectionHeading id={titleId} label={text.categoriesLabel} title={text.categoriesTitle} />
      <ul className={styles.grid}>
        {categories.map((category) => (
          <li key={category.slug}>
            <LocalizedLink to={paths.category(category.slug)} variant="card">
              <PhotoPlaceholder shape="category" />
              <span className={styles.name}>{category.name}</span>
            </LocalizedLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
