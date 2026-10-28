import { useState } from 'react';
import { useLoaderData } from 'react-router';
import { api, type CartLine, type CartQuantityRefusal } from '../../../api';
import { BRAND_NAME } from '../../../brand';
import { browser } from '../../../browser';
import type { Messages } from '../../../i18n/messages/ja';
import { useLocale } from '../../../i18n/useLocale';
import { useMessages } from '../../../i18n/useMessages';
import { paths } from '../../../paths';
import { Button } from '../../atoms/Button';
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

/**
 * Why a cart change changed nothing: the API refused it (409), or it failed;
 * or why checkout did not start: some lines cannot be bought as they are
 * (each named), or it failed.
 */
type ChangeProblem =
  | { outcome: 'refused'; refusal: CartQuantityRefusal }
  | { outcome: 'failed' }
  | { outcome: 'unavailable'; lines: string[] }
  | { outcome: 'checkout_failed' };

const FAILED: ChangeProblem = { outcome: 'failed' };
const CHECKOUT_FAILED: ChangeProblem = { outcome: 'checkout_failed' };

/**
 * The cart page: the cart's lines and amounts as the API answers with them
 * (the page computes none), where quantities can be changed and lines removed.
 * Once the API has answered a change, the page's data is reloaded, so the
 * lines, the amounts and the header's count show the cart as it is now.
 * Checking out sends the browser on to the payment page the API created; if
 * the API refuses, the page reloads the cart, whose lines then say why.
 */
export function CartPage() {
  const { cart, categories } = useLoaderData<typeof cartLoader>();
  const locale = useLocale();
  const text = useMessages().cart;
  const { busy, send } = useCartChange();
  const [problem, setProblem] = useState<ChangeProblem | null>(null);
  /** Set once the browser is on its way to the payment page. */
  const [leaving, setLeaving] = useState(false);

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

  async function checkout() {
    setProblem(null);
    const started = await send(async (): Promise<CartChangeAnswer<{ url: string } | ChangeProblem | null>> => {
      const res = await api.checkout.$post({ query: { locale } });
      if (res.ok) return { answered: false, result: await res.json() };
      if (res.status !== 409) return { answered: false, result: CHECKOUT_FAILED };
      // Refused: the cart is empty, or some lines cannot be bought as they are. The reloaded cart shows which.
      const refusal = await res.json();
      if (refusal.error === 'cart_empty') return { answered: true, result: null };
      const lines = refusal.lines.map((line) => text.lineName(line.name, line.variantLabel));
      return { answered: true, result: { outcome: 'unavailable', lines } };
    }, CHECKOUT_FAILED);
    if (started && 'url' in started) {
      setLeaving(true);
      browser.leaveFor(started.url);
    } else {
      setProblem(started);
    }
  }

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
              <Button
                variant="primary"
                className={styles.checkout}
                disabled={busy || leaving || !cart.lines.some((line) => line.available)}
                onClick={checkout}
              >
                {text.checkout}
              </Button>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}

function problemText(problem: ChangeProblem, text: Messages['cart']): string {
  if (problem.outcome === 'failed') return text.changeFailed;
  if (problem.outcome === 'checkout_failed') return text.checkoutFailed;
  if (problem.outcome === 'unavailable') return text.checkoutUnavailable(problem.lines);
  switch (problem.refusal.error) {
    case 'exceeds_available':
      return text.exceedsAvailable(problem.refusal.availableStock);
    case 'cart_too_large':
      return text.tooLarge;
  }
}
