import { useState } from 'react';
import { useLoaderData } from 'react-router';
import { useAdminChanges } from '../../../../adminChanges';
import type { FieldErrors } from '../../../../adminForms';
import { api, type AdminOrder } from '../../../../api';
import { carrierNameOf } from '../../../../carriers';
import { formatDateTime } from '../../../../i18n/format';
import type { Locale } from '../../../../i18n/locales';
import type { Messages } from '../../../../i18n/messages/ja';
import { useLocale } from '../../../../i18n/useLocale';
import { useMessages } from '../../../../i18n/useMessages';
import { paths } from '../../../../paths';
import { Button } from '../../../atoms/Button';
import { LocalizedLink } from '../../../atoms/LocalizedLink';
import { Notice } from '../../../atoms/Notice';
import { AdminPageHeading } from '../../../molecules/AdminPageHeading';
import { DetailList } from '../../../molecules/DetailList';
import { ShippingAddress } from '../../../molecules/ShippingAddress';
import { AdminChangeNotice } from '../../../organisms/AdminChangeNotice';
import { OrderLines } from '../../../organisms/OrderLines';
import { ShipmentForm, type ShipmentValues } from '../../../organisms/ShipmentForm';
import { useCsrfHeaders } from '../adminSession';
import type { adminOrderLoader } from './adminOrderLoader';

/**
 * One order, in any status: when it was placed, its status, the locale the
 * customer ordered in and how to reach them, how it shipped, its lines and
 * amounts, and where it ships. A paid order has the form that ships it; a
 * shipped one whose notice could not be sent, the way to send it again.
 */
export function AdminOrderPage() {
  const { order } = useLoaderData<typeof adminOrderLoader>();
  const messages = useMessages();
  const text = messages.admin;
  const detail = text.order;
  const locale = useLocale();
  const headers = useCsrfHeaders();
  const changes = useAdminChanges<'shipped' | 'noticeSent'>();
  const [errors, setErrors] = useState<FieldErrors>({});

  const param = { orderNumber: order.orderNumber };
  const ship = ({ carrier, carrierName, trackingNumber }: ShipmentValues) =>
    changes.send(
      () =>
        api.admin.orders[':orderNumber'].shipment.$post(
          {
            param,
            json: { version: order.version, carrier, trackingNumber, ...(carrier === 'other' && { carrierName }) },
          },
          { headers },
        ),
      { done: 'shipped', onStored: () => setErrors({}), onInvalid: setErrors },
    );
  const sendNotice = () =>
    changes.send(() => api.admin.orders[':orderNumber']['shipping-notice'].$post({ param }, { headers }), {
      done: 'noticeSent',
    });

  async function reload() {
    setErrors({});
    await changes.reload();
  }

  return (
    <>
      <AdminPageHeading title={detail.title(order.orderNumber)}>
        <LocalizedLink to={paths.adminOrders()} variant="buttonOutline">
          {detail.back}
        </LocalizedLink>
      </AdminPageHeading>
      <AdminChangeNotice
        notice={changes.notice}
        doneText={{ shipped: detail.shipped, noticeSent: detail.noticeSent }}
        staleText={detail.stale}
        onReload={reload}
      />
      <DetailList
        details={[
          { term: detail.placedAt, value: formatDateTime(order.placedAt, locale) },
          { term: detail.status, value: text.orderStatus[order.status] },
          { term: detail.orderedIn, value: text.localizedText[order.orderedIn] },
          { term: detail.email, value: order.email ?? detail.none },
          { term: detail.phone, value: order.phone ?? detail.none },
          ...shipmentDetails(order, messages, locale),
        ]}
      />
      {order.shipment && !order.shippingNoticeSent && (
        <Notice tone="problem">
          <span>{detail.noticeUnsent}</span>
          <Button variant="secondary" disabled={changes.busy} onClick={sendNotice}>
            {detail.sendNotice}
          </Button>
        </Notice>
      )}
      {order.status === 'paid' && <ShipmentForm errors={errors} submitting={changes.busy} onSubmit={ship} />}
      <OrderLines order={order} />
      <ShippingAddress address={order.shippingAddress} />
    </>
  );
}

/** How the order shipped, as details: its carrier by name, its tracking number and when; none before it ships. */
function shipmentDetails(order: AdminOrder, messages: Messages, locale: Locale) {
  const { shipment } = order;
  if (!shipment) return [];
  const detail = messages.admin.order;
  return [
    { term: detail.carrier, value: carrierNameOf(shipment, messages.carriers) },
    { term: detail.trackingNumber, value: shipment.trackingNumber },
    { term: detail.shippedAt, value: formatDateTime(shipment.shippedAt, locale) },
  ];
}
