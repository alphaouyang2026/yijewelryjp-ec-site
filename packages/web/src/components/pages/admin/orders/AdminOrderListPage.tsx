import { useLoaderData } from 'react-router';
import { useMessages } from '../../../../i18n/useMessages';
import { ORDER_STATUSES } from '../../../../orderStatuses';
import { paths } from '../../../../paths';
import { AdminPageHeading } from '../../../molecules/AdminPageHeading';
import { StatusFilter } from '../../../molecules/StatusFilter';
import { AdminOrderTable } from '../../../organisms/AdminOrderTable';
import type { adminOrderListLoader } from './adminOrderListLoader';

/** The orders the owner has something to do for (or one status's), each linking to its page. */
export function AdminOrderListPage() {
  const { list, status } = useLoaderData<typeof adminOrderListLoader>();
  const text = useMessages().admin;
  const filter = [
    { status: undefined, label: text.orderList.confirmed },
    ...ORDER_STATUSES.map((option) => ({ status: option, label: text.orderStatus[option] })),
  ].map((option) => ({ label: option.label, to: paths.adminOrders(option), current: option.status === status }));

  return (
    <>
      <AdminPageHeading title={text.sections.orders} />
      <StatusFilter label={text.orderList.filterNav} options={filter} />
      <AdminOrderTable orders={list.orders} emptyText={text.orderList.empty} />
    </>
  );
}
