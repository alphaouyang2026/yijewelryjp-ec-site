import { useMessages } from '../../i18n/useMessages';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import styles from './QuantityStepper.module.css';

/**
 * A quantity with buttons to take one off and add one, between `min` and
 * `max` (no upper bound without `max`). It shows `value` as it is given:
 * `onChange` asks for the new quantity, and the parent decides what is shown.
 */
export function QuantityStepper({
  value,
  min = 1,
  max,
  disabled = false,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
}) {
  const text = useMessages().quantityStepper;

  return (
    <div role="group" aria-label={text.quantity} className={styles.stepper}>
      <Button
        variant="icon"
        aria-label={text.decrease}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Icon name="minus" />
      </Button>
      <span aria-live="polite" className={styles.value}>
        {value}
      </span>
      <Button
        variant="icon"
        aria-label={text.increase}
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(value + 1)}
      >
        <Icon name="plus" />
      </Button>
    </div>
  );
}
