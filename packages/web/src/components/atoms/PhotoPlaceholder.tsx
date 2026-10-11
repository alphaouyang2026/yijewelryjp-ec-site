import styles from './PhotoPlaceholder.module.css';

/**
 * Where a photo goes when there is none (a product without photos, or the
 * home page's pictures until the brand's are in): a plain ground in the
 * photo's shape. Decorative, so hidden from assistive technology; the
 * product's name says what it is.
 */
export function PhotoPlaceholder({
  shape,
  ground = 'light',
}: {
  shape: 'product' | 'hero' | 'category';
  ground?: 'light' | 'dark';
}) {
  return <div aria-hidden="true" className={[styles.placeholder, styles[shape], styles[ground]].join(' ')} />;
}
