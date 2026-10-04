import type { Category } from '../api';
import { paths } from '../paths';

/** The site's category navigation: new arrivals first, then the shop's categories in the API's order. */
export function categoryLinks(categories: Category[]) {
  return [
    { to: paths.products, label: '新作' },
    ...categories.map((category) => ({ to: paths.category(category.slug), label: category.name })),
  ];
}
