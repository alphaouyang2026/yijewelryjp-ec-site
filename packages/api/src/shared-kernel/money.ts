/** An amount of Japanese yen. The site sells only in yen, which has no minor unit, so it is a whole number. */
export type Money = { readonly yen: number };

export function yen(amount: number): Money {
  if (!Number.isSafeInteger(amount)) throw new RangeError(`Money is a whole number of yen, got ${amount}`);
  return { yen: amount };
}
