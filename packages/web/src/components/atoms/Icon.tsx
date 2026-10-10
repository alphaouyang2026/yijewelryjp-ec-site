import styles from './Icon.module.css';

/** Each icon's path data, on a 24 × 24 grid. Icon.module.css sets their size and stroke. */
const icons = {
  bag: ['M5 8h14l-1.2 13H6.2L5 8z', 'M9 8V6.5a3 3 0 0 1 6 0V8'],
  truck: [
    'M2.5 6.5h11v10h-11z',
    'M13.5 10h4l3.5 3.5v3h-7.5',
    'M5 17.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0',
    'M15.5 17.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0',
  ],
  lock: ['M5 10.5h14v10H5z', 'M8 10.5V8a4 4 0 0 1 8 0v2.5'],
  mail: ['M3 5.5h18v13H3z', 'M3 6.5l9 7 9-7'],
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
