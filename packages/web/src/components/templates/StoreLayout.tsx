import type { ReactNode } from 'react';
import type { Category } from '../../api';
import { AnnouncementBar } from '../organisms/AnnouncementBar';
import { SiteFooter } from '../organisms/SiteFooter';
import { SiteHeader } from '../organisms/SiteHeader';

/**
 * The storefront's page frame: announcement bar, header, the page's content,
 * footer. `cartItemCount` is how many items the cart holds (null when not known).
 */
export function StoreLayout({
  categories,
  cartItemCount,
  children,
}: {
  categories: Category[];
  cartItemCount: number | null;
  children: ReactNode;
}) {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader categories={categories} cartItemCount={cartItemCount} />
      <main>{children}</main>
      <SiteFooter categories={categories} />
    </>
  );
}
