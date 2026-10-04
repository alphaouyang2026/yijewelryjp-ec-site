import styles from './Icon.module.css';

/** Each icon's path data, on a 24 × 24 grid. Icon.module.css sets their size and stroke. */
const icons = {
  bag: ['M5 8h14l-1.2 13H6.2L5 8z', 'M9 8V6.5a3 3 0 0 1 6 0V8'],
};

export type IconName = keyof typeof icons;

/** A decorative icon: hidden from assistive technology, so its link or button needs its own accessible name. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      {icons[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
