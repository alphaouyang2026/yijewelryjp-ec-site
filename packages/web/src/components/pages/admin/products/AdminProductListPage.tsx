import { useLoaderData } from 'react-router';
import { useMessages } from '../../../../i18n/useMessages';
import { paths } from '../../../../paths';
import { LocalizedLink } from '../../../atoms/LocalizedLink';
import { AdminPageHeading } from '../../../molecules/AdminPageHeading';
import { StatusFilter } from '../../../molecules/StatusFilter';
import { AdminProductTable } from '../../../organisms/AdminProductTable';
import type { adminProductListLoader } from './adminProductListLoader';

/** Every product, in any status (or one), each linking to its edit page; and the way to add one. */
export function AdminProductListPage() {
  const { list, status } = useLoaderData<typeof adminProductListLoader>();
  const text = useMessages().admin;

  return (
    <>
      <AdminPageHeading title={text.sections.products}>
        <LocalizedLink to={paths.adminNewProduct} variant="buttonOutline">
          {text.productList.add}
        </LocalizedLink>
      </AdminPageHeading>
      <StatusFilter current={status} />
      <AdminProductTable products={list.products} emptyText={text.productList.empty} />
    </>
  );
}
