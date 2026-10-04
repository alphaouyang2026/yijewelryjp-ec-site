import { Link, type LinkProps } from 'react-router';
import { localizedPath } from '../../i18n/locales';
import { useLocale } from '../../i18n/useLocale';

type LocalizedLinkProps = Omit<LinkProps, 'to'> & {
  /** A page path from paths.ts, without a locale prefix. */
  to: string;
};

/** A router link to `to` in the current page's locale, so links never drop the visitor's language. */
export function LocalizedLink({ to, ...props }: LocalizedLinkProps) {
  return <Link to={localizedPath(useLocale(), to)} {...props} />;
}
