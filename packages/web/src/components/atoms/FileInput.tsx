import type { ReactNode } from 'react';
import styles from './FileInput.module.css';

/**
 * A button that opens the browser's file picker, outlined like a secondary
 * button; `children` is its text, which also names it. The files the owner
 * picks go to `onPick`, and the picker is then emptied, so the same file can
 * be picked again. `accept` lists the content types the picker offers.
 */
export function FileInput({
  accept,
  multiple = false,
  disabled = false,
  onPick,
  children,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onPick: (files: File[]) => void;
  children: ReactNode;
}) {
  return (
    <label className={styles.picker}>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length > 0) onPick(files);
        }}
        className={styles.input}
      />
      <span className={styles.face}>{children}</span>
    </label>
  );
}
