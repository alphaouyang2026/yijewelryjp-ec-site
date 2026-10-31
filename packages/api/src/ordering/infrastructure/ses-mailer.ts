import { SendEmailCommand, type SESv2Client } from '@aws-sdk/client-sesv2';
import type { Mailer } from '../domain/mailer';

/**
 * Mail through Amazon SES, from `from` (e.g. `Y&I Jewelry <noreply@example.com>`,
 * an address of the stage's verified domain identity), with replies going to
 * `replyTo` when given. The function's role must be allowed to send as `from`.
 */
export function sesMailer(client: SESv2Client, { from, replyTo }: { from: string; replyTo?: string }): Mailer {
  return {
    async send(email) {
      await client.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          ReplyToAddresses: replyTo ? [replyTo] : undefined,
          Destination: { ToAddresses: [email.to] },
          Content: {
            Simple: {
              Subject: { Data: email.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: email.text, Charset: 'UTF-8' },
                Html: { Data: email.html, Charset: 'UTF-8' },
              },
            },
          },
        }),
      );
    },
  };
}
