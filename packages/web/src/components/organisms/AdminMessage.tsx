import styles from './AdminMessage.module.css';

/** An admin page that only has something to say: its title and a line of text. */
export function AdminMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.message}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.text}>{text}</p>
    </div>
  );
}
