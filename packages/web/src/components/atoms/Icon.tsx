/** Line icons in the spec's style: thin strokes in the current text color. */
const icons = {
  bag: ['M5 8h14l-1.2 13H6.2L5 8z', 'M9 8V6.5a3 3 0 0 1 6 0V8'],
};

export type IconName = keyof typeof icons;

/** A decorative icon: hidden from assistive technology, so its link or button needs its own accessible name. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
