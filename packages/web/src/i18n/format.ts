const yenDigits = new Intl.NumberFormat('ja-JP');

/** An amount of yen as the site writes it in every locale: ¥24,000. */
export function formatYen(yen: number): string {
  return `¥${yenDigits.format(yen)}`;
}
