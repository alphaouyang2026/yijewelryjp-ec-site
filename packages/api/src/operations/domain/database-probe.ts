/** The API's database, as the health check sees it. */
export interface DatabaseProbe {
  /** Resolves if the database answers and the API's table exists; rejects otherwise. */
  check(): Promise<void>;
}
