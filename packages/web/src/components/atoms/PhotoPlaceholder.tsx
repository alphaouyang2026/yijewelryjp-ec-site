import styles from './PhotoPlaceholder.module.css';

/**
 * Where a photo will go until the owner uploads one (photo upload is a later
 * ticket): a plain ground in the photo's shape. Decorative, so hidden from
 * assistive technology; the product's name says what it is.
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
