import { Link, type LinkProps } from 'react-router';
import { localizedPath, type Locale } from '../../i18n/locales';
import { useLocale } from '../../i18n/useLocale';

type LocalizedLinkProps = Omit<LinkProps, 'to'> & {
  /** A page path from paths.ts, without a locale prefix. */
  to: string;
  /** The locale to link to; the current page's unless switching languages. */
  locale?: Locale;
};

/** A router link to `to` in the current page's locale, so links never drop the visitor's language. */
export function LocalizedLink({ to, locale, ...props }: LocalizedLinkProps) {
  const currentLocale = useLocale();
  return <Link to={localizedPath(locale ?? currentLocale, to)} {...props} />;
}
