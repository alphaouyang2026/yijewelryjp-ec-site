import { useId } from 'react';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { Label } from '../atoms/Label';
import { LocalizedLink } from '../atoms/LocalizedLink';
import { PhotoPlaceholder } from '../atoms/PhotoPlaceholder';
import styles from './HeroSection.module.css';

/** The home page's main visual (dark area): the brand message beside the collection's photo, and a link to the collection. */
export function HeroSection() {
  const text = useMessages().home;
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={styles.hero}>
      <div className={styles.copy}>
        <Label ground="dark">{text.heroLabel}</Label>
        <h1 id={titleId} className={styles.message}>
          {text.heroMessage}
        </h1>
        <p className={styles.intro}>{text.heroIntro}</p>
        <div>
          <LocalizedLink to={paths.products} variant="buttonGold">
            {text.heroCta}
          </LocalizedLink>
        </div>
      </div>
      <div className={styles.photo}>
        <PhotoPlaceholder shape="hero" ground="dark" />
      </div>
    </section>
  );
}
