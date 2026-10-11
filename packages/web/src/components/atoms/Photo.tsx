import styles from './Photo.module.css';

/**
 * A photo filling its box in the photo's shape, cropped to it if need be, on
 * the photo ground of a `light` or `dark` area while it loads. `alt` says
 * what it shows. Photos further down a page load as they come into view,
 * unless `eager`.
 */
export function Photo({
  src,
  alt,
  shape,
  ground = 'light',
  eager = false,
}: {
  src: string;
  alt: string;
  shape: 'product';
  ground?: 'light' | 'dark';
  eager?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={[styles.photo, styles[shape], styles[ground]].join(' ')}
    />
  );
}
