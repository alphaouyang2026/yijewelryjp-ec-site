import { useMessages } from '../../../i18n/useMessages';
import { PageMessage } from '../../organisms/PageMessage';
import { StoreLayout } from '../../templates/StoreLayout';
import { useCartItemCount } from '../store/storeFrame';

/**
 * Shown for a URL the site does not have and for a product or category the
 * API does not know. It has no data of its own, so the navigation shows only
 * its fixed links.
 */
export function NotFoundPage() {
  const text = useMessages().notFound;
  return (
    <StoreLayout categories={[]} cartItemCount={useCartItemCount()}>
      <PageMessage title={text.title} text={text.text} homeLink={text.home} />
    </StoreLayout>
  );
}
