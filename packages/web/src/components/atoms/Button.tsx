import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  /** On light grounds (spec #1): `primary` is onyx with light text, `secondary` is outlined in onyx. */
  variant: 'primary' | 'secondary';
  /** For the parent's layout and spacing only; `variant` sets the look. */
  className?: string;
};

/** A button (not a link) for an action on the page. Its text comes from `children`. */
export function Button({ variant, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={[styles[variant], className].filter(Boolean).join(' ')} {...props} />;
}
