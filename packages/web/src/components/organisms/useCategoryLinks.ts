import type { Category } from '../../api';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import type { NavLinkItem } from '../molecules/NavLinkList';

/** The site's category navigation: new arrivals first, then the shop's categories in the API's order. */
export function useCategoryLinks(categories: Category[]): NavLinkItem[] {
  const text = useMessages().categoryNav;
  return [
    { to: paths.products, text: text.newArrivals },
    ...categories.map((category) => ({ to: paths.category(category.slug), text: category.name })),
  ];
}
