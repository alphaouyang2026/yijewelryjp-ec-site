import type { ReactNode } from 'react';
import type { Category } from '../api';
import { AnnouncementBar } from './AnnouncementBar';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function SiteLayout({ categories, children }: { categories: Category[]; children: ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader categories={categories} />
      <main>{children}</main>
      <SiteFooter categories={categories} />
    </>
  );
}
