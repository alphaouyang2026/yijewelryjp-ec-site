import styles from './PhotoThumbnail.module.css';

/**
 * A small photo to press to show it large: a button named by the photo's
 * `alt`, marked pressed (with a double onyx line, as a chosen size) while its
 * photo is the one shown.
 */
export function PhotoThumbnail({
  src,
  alt,
  pressed,
  onPress,
}: {
  src: string;
  alt: string;
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onPress} className={styles.thumbnail}>
      <img src={src} alt={alt} loading="lazy" decoding="async" className={styles.photo} />
    </button>
  );
}
