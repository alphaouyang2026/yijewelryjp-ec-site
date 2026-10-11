import type { PhotoValues } from '../../adminForms';
import { useLocale } from '../../i18n/useLocale';
import { useMessages } from '../../i18n/useMessages';
import { Button } from '../atoms/Button';
import { Photo } from '../atoms/Photo';
import { LocalizedTextField } from './LocalizedTextField';
import styles from './PhotoFields.module.css';

/**
 * One photo in the product form, a group named after its `number` (its place
 * in the order): a preview, its alt text per locale (Japanese required), and
 * buttons to move it earlier or later and to remove it from the product.
 * `errorOf` gives a field's error text by its path within the photo ('alt.ja').
 */
export function PhotoFields({
  number,
  count,
  value,
  onChange,
  onMove,
  onRemove,
  errorOf,
}: {
  number: number;
  /** How many photos there are, so the last cannot move later. */
  count: number;
  value: PhotoValues;
  onChange: (value: PhotoValues) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  errorOf: (path: string) => string | undefined;
}) {
  const text = useMessages().admin.productForm;
  const locale = useLocale();
  return (
    <fieldset className={styles.photo}>
      <legend className={styles.legend}>{text.photo(number)}</legend>
      <div className={styles.layout}>
        <div className={styles.preview}>
          <Photo src={value.url} alt={value.alt[locale] || value.alt.ja || text.photo(number)} shape="product" />
        </div>
        <div className={styles.fields}>
          <LocalizedTextField
            label={text.photoAlt}
            hint={text.photoAltHint}
            required
            value={value.alt}
            onChange={(alt) => onChange({ ...value, alt })}
            errors={{ ja: errorOf('alt.ja'), zh: errorOf('alt.zh'), en: errorOf('alt.en') }}
          />
          <div className={styles.actions}>
            <Button variant="secondary" disabled={number === 1} onClick={() => onMove(-1)}>
              {text.movePhotoEarlier(number)}
            </Button>
            <Button variant="secondary" disabled={number === count} onClick={() => onMove(1)}>
              {text.movePhotoLater(number)}
            </Button>
            <Button variant="secondary" onClick={onRemove}>
              {text.removePhoto(number)}
            </Button>
          </div>
        </div>
      </div>
    </fieldset>
  );
}
