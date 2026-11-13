import type { Mailer } from '../domain/mailer';

/**
 * Mail that goes nowhere: each email's plain-text part is printed to the
 * console instead. For local development, and for a deployment without a
 * domain to send from.
 */
export function consoleMailer(): Mailer {
  return {
    async send(email) {
      console.log(`--- Email (not sent) to ${email.to}: ${email.subject}\n${email.text}---`);
    },
  };
}
