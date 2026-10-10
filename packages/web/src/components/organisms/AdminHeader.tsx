import { BRAND_NAME } from '../../brand';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { Button } from '../atoms/Button';
import { Label } from '../atoms/Label';
import { LocalizedLink } from '../atoms/LocalizedLink';
import { LocaleSwitcher } from '../molecules/LocaleSwitcher';
import styles from './AdminHeader.module.css';

/**
 * The admin's header, on a light ground: the brand (linking to the admin's
 * first page), who is signed in, the locale switcher and the sign-out button.
 */
export function AdminHeader({
  ownerEmail,
  onSignOut,
  signingOut,
}: {
  ownerEmail: string;
  onSignOut: () => void;
  /** While signing out, the button cannot be pressed again. */
  signingOut: boolean;
}) {
  const text = useMessages().admin;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <LocalizedLink to={paths.admin} className={styles.brand}>
          <span className={styles.brandName}>{BRAND_NAME}</span>
          <Label ground="light">{text.label}</Label>
        </LocalizedLink>
        <div className={styles.tools}>
          <p className={styles.owner}>
            <span className={styles.ownerLabel}>{text.signedInAs}</span> <span>{ownerEmail}</span>
          </p>
          <LocaleSwitcher ground="light" />
          <Button variant="secondary" onClick={onSignOut} disabled={signingOut}>
            {text.signOut}
          </Button>
        </div>
      </div>
    </header>
  );
}
