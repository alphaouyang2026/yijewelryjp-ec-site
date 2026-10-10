import type { ReactNode } from 'react';
import { AdminHeader } from '../organisms/AdminHeader';
import { AdminNav } from '../organisms/AdminNav';
import styles from './AdminLayout.module.css';

/** The admin's page frame, all on light grounds: header, section navigation, the page's content. */
export function AdminLayout({
  ownerEmail,
  onSignOut,
  signingOut,
  children,
}: {
  ownerEmail: string;
  onSignOut: () => void;
  signingOut: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <AdminHeader ownerEmail={ownerEmail} onSignOut={onSignOut} signingOut={signingOut} />
      <AdminNav />
      <main className={styles.main}>{children}</main>
    </>
  );
}
