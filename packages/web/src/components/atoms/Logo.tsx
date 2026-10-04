import { LOGO_FILE_SIZE, logoUrl } from '../../brand';
import styles from './Logo.module.css';

/** The gold logo, for onyx or charcoal grounds only, at the spec's header or footer size. */
export function Logo({ alt, size }: { alt: string; size: 'header' | 'footer' }) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      width={LOGO_FILE_SIZE.width}
      height={LOGO_FILE_SIZE.height}
      className={styles[size]}
    />
  );
}
