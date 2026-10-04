import { Label } from '../atoms/Label';
import styles from './SectionHeading.module.css';

/** A section's heading on a light ground: the English label above the title. `id` lets the section name itself after the title. */
export function SectionHeading({ label, title, id }: { label: string; title: string; id: string }) {
  return (
    <div className={styles.heading}>
      <Label ground="light">{label}</Label>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
    </div>
  );
}
