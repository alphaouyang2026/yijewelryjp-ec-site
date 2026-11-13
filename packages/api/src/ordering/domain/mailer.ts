/** An email, rendered: its recipient, subject, and the same content as plain text and as HTML. */
export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Sends the store's emails (SES), which the store cannot control: production
 * uses the SES adapter, tests an in-memory one. The sender, and where replies
 * go, are the deployment's.
 */
export interface Mailer {
  /** Sends `email`. Rejects if the service fails or refuses it. */
  send(email: Email): Promise<void>;
}
