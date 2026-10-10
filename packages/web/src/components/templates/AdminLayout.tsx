import type { ReactNode } from 'react';
import { AdminHeader, type AdminHeaderOwner } from '../organisms/AdminHeader';
import { AdminNav } from '../organisms/AdminNav';
import styles from './AdminLayout.module.css';

/**
 * The admin's page frame, all on light grounds: the header, then in an owner's
 * session the section navigation, then the page's content. Without `owner`
 * (pages open before signing in, or when the admin could not be shown), only
 * the header and the content.
 */
export function AdminLayout({ owner, children }: { owner?: AdminHeaderOwner; children: ReactNode }) {
  return (
    <>
      <AdminHeader owner={owner} />
      {owner && <AdminNav />}
      <main className={styles.main}>{children}</main>
    </>
  );
}
