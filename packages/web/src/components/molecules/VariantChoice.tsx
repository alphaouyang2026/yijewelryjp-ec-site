import { useId } from 'react';
import type { Variant } from '../../api';
import { useMessages } from '../../i18n/useMessages';
import { ChoiceChip } from '../atoms/ChoiceChip';
import styles from './VariantChoice.module.css';

/** The product's sizes as one choice; sold-out sizes cannot be chosen. `chosen` is the chosen size's SKU, if any. */
export function VariantChoice({
  variants,
  chosen,
  onChoose,
}: {
  variants: Variant[];
  chosen: string | undefined;
  onChoose: (sku: string) => void;
}) {
  const text = useMessages().productPage;
  const labelId = useId();
  const groupName = useId();

  return (
    <div role="radiogroup" aria-labelledby={labelId} className={styles.choice}>
      <p id={labelId} className={styles.label}>
        {text.sizeChoice}
      </p>
      <div className={styles.chips}>
        {variants.map((variant) => (
          <ChoiceChip
            key={variant.sku}
            name={groupName}
            value={variant.sku}
            checked={variant.sku === chosen}
            disabled={variant.stockStatus === 'sold_out'}
            onChoose={onChoose}
          >
            {variant.label}
          </ChoiceChip>
        ))}
      </div>
    </div>
  );
}
