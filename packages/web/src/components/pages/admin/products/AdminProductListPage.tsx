import { useLoaderData } from 'react-router';
import { useMessages } from '../../../../i18n/useMessages';
import { paths } from '../../../../paths';
import { PRODUCT_STATUSES } from '../../../../productStatuses';
import { LocalizedLink } from '../../../atoms/LocalizedLink';
import { AdminPageHeading } from '../../../molecules/AdminPageHeading';
import { StatusFilter } from '../../../molecules/StatusFilter';
import { AdminProductTable } from '../../../organisms/AdminProductTable';
import type { adminProductListLoader } from './adminProductListLoader';

/** Every product, in any status (or one), each linking to its edit page; and the way to add one. */
export function AdminProductListPage() {
  const { list, status } = useLoaderData<typeof adminProductListLoader>();
  const text = useMessages().admin;
  const filter = [
    { status: undefined, label: text.productList.all },
    ...PRODUCT_STATUSES.map((option) => ({ status: option, label: text.productStatus[option] })),
  ].map((option) => ({ label: option.label, to: paths.adminProducts(option), current: option.status === status }));

  return (
    <>
      <AdminPageHeading title={text.sections.products}>
        <LocalizedLink to={paths.adminNewProduct} variant="buttonOutline">
          {text.productList.add}
        </LocalizedLink>
      </AdminPageHeading>
      <StatusFilter label={text.productList.filterNav} options={filter} />
      <AdminProductTable products={list.products} emptyText={text.productList.empty} />
    </>
  );
}
