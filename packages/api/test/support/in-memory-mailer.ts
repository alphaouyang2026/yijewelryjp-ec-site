import type { Email, Mailer } from '../../src/ordering/domain/mailer';

export type InMemoryMailer = Mailer & {
  /** Every email sent, oldest first. */
  readonly outbox: Email[];
  /** The mail service fails the next email (to `to`, if given), as when SES is down. */
  failNextSend(which?: { to?: string }): void;
};

/** The Mailer tests use: it keeps what the API sends in an outbox, and delivers nothing. */
export function createInMemoryMailer(): InMemoryMailer {
  const outbox: Email[] = [];
  let failNext: { to?: string } | undefined;
  return {
    outbox,
    async send(email) {
      if (failNext && (failNext.to === undefined || failNext.to === email.to)) {
        failNext = undefined;
        throw new Error('The mail service is unavailable');
      }
      outbox.push(email);
    },
    failNextSend(which = {}) {
      failNext = which;
    },
  };
}
