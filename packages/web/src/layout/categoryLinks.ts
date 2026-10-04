import type { Category } from '../api';

/** The site's category navigation: new arrivals first, then the shop's categories in the API's order. */
export function categoryLinks(categories: Category[]) {
  return [
    { to: '/products', label: '新作' },
    ...categories.map((category) => ({ to: `/categories/${category.slug}`, label: category.name })),
  ];
}
