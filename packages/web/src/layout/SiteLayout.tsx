import type { ReactNode } from 'react';
import { AnnouncementBar } from './AnnouncementBar';
import type { CategoryLink } from './categoryLinks';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function SiteLayout({ categories, children }: { categories: CategoryLink[]; children: ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader categories={categories} />
      <main>{children}</main>
      <SiteFooter categories={categories} />
    </>
  );
}
