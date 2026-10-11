import { useId } from 'react';
import type { LocalizedValues } from '../../adminForms';
import type { AdminCategory } from '../../api';
import type { Locale } from '../../i18n/locales';
import { useMessages } from '../../i18n/useMessages';
import { CategoryItem } from '../molecules/CategoryItem';
import styles from './CategoryList.module.css';

/**
 * The categories in the owner's order, which the store's navigation follows:
 * each can move up or down and be renamed. `renameErrorsOf` gives the API's
 * errors for a category's last rename, per locale.
 */
export function CategoryList({
  categories,
  busy,
  renameErrorsOf,
  onMove,
  onRename,
}: {
  categories: AdminCategory[];
  busy: boolean;
  renameErrorsOf: (slug: string) => Partial<Record<Locale, string>>;
  onMove: (index: number, direction: -1 | 1) => void;
  onRename: (category: AdminCategory, name: LocalizedValues) => void;
}) {
  const text = useMessages().admin.categories;
  const headingId = useId();
  return (
    <section className={styles.section}>
      <h2 id={headingId} className={styles.title}>
        {text.orderTitle}
      </h2>
      <p className={styles.hint}>{text.orderHint}</p>
      {categories.length === 0 ? (
        <p className={styles.hint}>{text.empty}</p>
      ) : (
        <ol aria-labelledby={headingId} className={styles.list}>
          {categories.map((category, index) => (
            <li key={category.slug}>
              <CategoryItem
                category={category}
                first={index === 0}
                last={index === categories.length - 1}
                busy={busy}
                errors={renameErrorsOf(category.slug)}
                onMove={(direction) => onMove(index, direction)}
                onRename={(name) => onRename(category, name)}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
