import { BRAND_NAME } from '../../brand';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { Button } from '../atoms/Button';
import { Label } from '../atoms/Label';
import { LocalizedLink } from '../atoms/LocalizedLink';
import { LocaleSwitcher } from '../molecules/LocaleSwitcher';
import styles from './AdminHeader.module.css';

/** The signed-in owner, as the admin's header shows them. */
export type AdminHeaderOwner = {
  email: string;
  onSignOut: () => void;
  /** While signing out, the button cannot be pressed again. */
  signingOut: boolean;
};

/**
 * The admin's header, on a light ground: the brand (linking to the admin's
 * first page) and the locale switcher; in an owner's session, also who is
 * signed in and the sign-out button.
 */
export function AdminHeader({ owner }: { owner?: AdminHeaderOwner }) {
  const text = useMessages().admin;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <LocalizedLink to={paths.admin} className={styles.brand}>
          <span className={styles.brandName}>{BRAND_NAME}</span>
          <Label ground="light">{text.label}</Label>
        </LocalizedLink>
        <div className={styles.tools}>
          {owner && (
            <p className={styles.owner}>
              <span className={styles.ownerLabel}>{text.signedInAs}</span> <span>{owner.email}</span>
            </p>
          )}
          <LocaleSwitcher ground="light" />
          {owner && (
            <Button variant="secondary" onClick={owner.onSignOut} disabled={owner.signingOut}>
              {text.signOut}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
