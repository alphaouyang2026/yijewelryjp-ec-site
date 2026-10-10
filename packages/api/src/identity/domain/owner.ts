/** A person at Y&I who manages the site. Every owner has the same rights. */
export type Owner = {
  /** The identity provider's stable id for the owner (Cognito's `sub`). */
  readonly id: string;
  readonly email: string;
};
