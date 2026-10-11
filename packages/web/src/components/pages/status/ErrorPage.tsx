import { useMessages } from '../../../i18n/useMessages';
import { PageMessage } from '../../organisms/PageMessage';
import { StoreLayout } from '../../templates/StoreLayout';
import { useCartItemCount } from '../store/storeFrame';

/** Shown when a page's data could not be loaded, for example while the API is unavailable. */
export function ErrorPage() {
  const text = useMessages().error;
  return (
    <StoreLayout categories={[]} cartItemCount={useCartItemCount()}>
      <PageMessage title={text.title} text={text.text} homeLink={text.home} />
    </StoreLayout>
  );
}
