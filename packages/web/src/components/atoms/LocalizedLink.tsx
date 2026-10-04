import { Link, type LinkProps } from 'react-router';
import { localizedPath, type Locale } from '../../i18n/locales';
import { useLocale } from '../../i18n/useLocale';
import type { PagePath } from '../../paths';
import styles from './LocalizedLink.module.css';

type LocalizedLinkProps = Omit<LinkProps, 'to' | 'className'> & {
  /** The page to link to, from paths.ts. */
  to: PagePath;
  /** The locale to link to; the current page's unless switching locales. */
  locale?: Locale;
  /**
   * How the link looks, on the dark grounds where the site's links sit: `nav`
   * for navigation text, `caption` for small text, `icon` for an icon. Leave it
   * out for a link around something with its own look, such as the logo.
   */
  variant?: 'nav' | 'caption' | 'icon';
  /** For the parent's layout and spacing only; `variant` sets the look. */
  className?: string;
};

/** A router link to `to` in the current page's locale, so links never drop the visitor's locale. */
export function LocalizedLink({ to, locale, variant, className, ...props }: LocalizedLinkProps) {
  const currentLocale = useLocale();
  const classes = [variant && styles[variant], className].filter(Boolean).join(' ');
  return <Link to={localizedPath(locale ?? currentLocale, to)} className={classes || undefined} {...props} />;
}
