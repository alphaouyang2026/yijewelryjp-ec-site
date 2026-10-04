import type { ReactNode } from 'react';
import type { Category } from '../../api';
import { AnnouncementBar } from '../organisms/AnnouncementBar';
import { SiteFooter } from '../organisms/SiteFooter';
import { SiteHeader } from '../organisms/SiteHeader';

/** The storefront's page frame: announcement bar, header, the page's content, footer. */
export function StoreLayout({ categories, children }: { categories: Category[]; children: ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader categories={categories} />
      <main>{children}</main>
      <SiteFooter categories={categories} />
    </>
  );
}
