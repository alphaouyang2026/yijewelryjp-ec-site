import { useState } from 'react';
import { useLoaderData } from 'react-router';
import { api, type CartLine, type CartQuantityRefusal } from '../../../api';
import { BRAND_NAME } from '../../../brand';
import type { Messages } from '../../../i18n/messages/ja';
import { useLocale } from '../../../i18n/useLocale';
import { useMessages } from '../../../i18n/useMessages';
import { paths } from '../../../paths';
import { LocalizedLink } from '../../atoms/LocalizedLink';
import { Notice } from '../../atoms/Notice';
import { CartSummary } from '../../molecules/CartSummary';
import { SectionHeading } from '../../molecules/SectionHeading';
import { CartTable } from '../../organisms/CartTable';
import { StoreLayout } from '../../templates/StoreLayout';
import { useCartQuantity } from '../store/storeFrame';
import { useCartChange, type CartChangeAnswer } from '../store/useCartChange';
import styles from './CartPage.module.css';
import type { cartLoader } from './cartLoader';

/** Why a cart change changed nothing: the API refused it (409), or it failed. */
type ChangeProblem = { outcome: 'refused'; refusal: CartQuantityRefusal } | { outcome: 'failed' };

const FAILED: ChangeProblem = { outcome: 'failed' };

/**
 * The cart page: the cart's lines and amounts as the API answers with them
 * (the page computes none), where quantities can be changed and lines removed.
 * Once the API has answered a change, the page's data is reloaded, so the
 * lines, the amounts and the header's count show the cart as it is now.
 */
export function CartPage() {
  const { cart, categories } = useLoaderData<typeof cartLoader>();
  const locale = useLocale();
  const text = useMessages().cart;
  const { busy, send } = useCartChange();
  const [problem, setProblem] = useState<ChangeProblem | null>(null);

  async function change(request: () => Promise<CartChangeAnswer<ChangeProblem | null>>) {
    setProblem(null);
    setProblem(await send(request, FAILED));
  }

  const changeQuantity = (line: CartLine, quantity: number) =>
    change(async () => {
      const res = await api.cart.lines[':lineId'].$put({
        param: { lineId: line.lineId },
        query: { locale },
        json: { quantity },
      });
      if (res.ok) return { answered: true, result: null };
      if (res.status === 409) return { answered: true, result: { outcome: 'refused', refusal: await res.json() } };
      // 404: the line is no longer in the cart (changed in another tab, say).
      return { answered: res.status === 404, result: FAILED };
    });

  const remove = (line: CartLine) =>
    change(async () => {
      const res = await api.cart.lines[':lineId'].$delete({ param: { lineId: line.lineId }, query: { locale } });
      return res.ok ? { answered: true, result: null } : { answered: false, result: FAILED };
    });

  return (
    <StoreLayout categories={categories} cartQuantity={useCartQuantity()}>
      <title>{`${text.title} | ${BRAND_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <div className={styles.page}>
        <SectionHeading level={1} label={text.label} title={text.title} />
        {problem && <Notice tone="problem">{problemText(problem, text)}</Notice>}
        {cart.lines.length === 0 ? (
          <div className={styles.empty}>
            <p>{text.empty}</p>
            <LocalizedLink to={paths.products} variant="buttonOutline">
              {text.continueShopping}
            </LocalizedLink>
          </div>
        ) : (
          <div className={styles.cart}>
            <CartTable lines={cart.lines} busy={busy} onChangeQuantity={changeQuantity} onRemove={remove} />
            <div className={styles.summary}>
              <CartSummary cart={cart} />
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}

function problemText(problem: ChangeProblem, text: Messages['cart']): string {
  if (problem.outcome === 'failed') return text.changeFailed;
  switch (problem.refusal.error) {
    case 'exceeds_available':
      return text.exceedsAvailable(problem.refusal.availableStock);
    case 'cart_too_large':
      return text.tooLarge;
  }
}
