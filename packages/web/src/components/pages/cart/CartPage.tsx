import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import { api, type CartLine } from '../../../api';
import { BRAND_NAME } from '../../../brand';
import { useLocale } from '../../../i18n/useLocale';
import { useMessages } from '../../../i18n/useMessages';
import { paths } from '../../../paths';
import { LocalizedLink } from '../../atoms/LocalizedLink';
import { Notice } from '../../atoms/Notice';
import { CartSummary } from '../../molecules/CartSummary';
import { SectionHeading } from '../../molecules/SectionHeading';
import { CartTable } from '../../organisms/CartTable';
import { StoreLayout } from '../../templates/StoreLayout';
import { useCartItemCount } from '../store/storeFrame';
import styles from './CartPage.module.css';
import type { cartLoader } from './cartLoader';

/** Why a cart change changed nothing: not that many in stock, or it failed. */
type ChangeProblem = { problem: 'exceeds_available'; availableStock: number } | { problem: 'failed' };

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
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ChangeProblem | null>(null);

  /** Sends a change; the API's answer (`answered`) means the data is reloaded, whether or not it changed anything. */
  async function change(send: () => Promise<{ answered: boolean; problem: ChangeProblem | null }>) {
    setBusy(true);
    setProblem(null);
    let outcome: Awaited<ReturnType<typeof send>>;
    try {
      outcome = await send();
    } catch {
      outcome = { answered: false, problem: { problem: 'failed' } };
    }
    setProblem(outcome.problem);
    if (outcome.answered) await revalidator.revalidate();
    setBusy(false);
  }

  const changeQuantity = (line: CartLine, quantity: number) =>
    change(async () => {
      const res = await api.cart.lines[':lineId'].$put({
        param: { lineId: line.lineId },
        query: { locale },
        json: { quantity },
      });
      if (res.ok) return { answered: true, problem: null };
      if (res.status === 409) {
        const { availableStock } = await res.json();
        return { answered: true, problem: { problem: 'exceeds_available', availableStock } };
      }
      // 404: the line is no longer in the cart (changed in another tab, say).
      return { answered: res.status === 404, problem: { problem: 'failed' } };
    });

  const remove = (line: CartLine) =>
    change(async () => {
      const res = await api.cart.lines[':lineId'].$delete({ param: { lineId: line.lineId }, query: { locale } });
      return res.ok ? { answered: true, problem: null } : { answered: false, problem: { problem: 'failed' } };
    });

  return (
    <StoreLayout categories={categories} cartItemCount={useCartItemCount()}>
      <title>{`${text.title} | ${BRAND_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <div className={styles.page}>
        <SectionHeading level={1} label={text.label} title={text.title} />
        {problem && (
          <Notice tone="problem">
            {problem.problem === 'exceeds_available' ? text.exceedsAvailable(problem.availableStock) : text.changeFailed}
          </Notice>
        )}
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
