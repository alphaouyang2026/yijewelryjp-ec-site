import { Label } from '../atoms/Label';
import styles from './SectionHeading.module.css';

/**
 * A section's heading on a light ground: the English label above the title.
 * `id` lets the section name itself after the title; `level` is 1 when the
 * heading titles the whole page.
 */
export function SectionHeading({
  label,
  title,
  id,
  level = 2,
}: {
  label: string;
  title: string;
  id?: string;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className={styles.heading}>
      <Label ground="light">{label}</Label>
      <Heading id={id} className={styles.title}>
        {title}
      </Heading>
    </div>
  );
}
