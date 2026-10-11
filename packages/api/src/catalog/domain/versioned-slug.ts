/**
 * A product or category as the owner saw it: its slug, and the version it was
 * at. The owner's changes are made from it, and saved only if the stored one
 * is still at that version.
 */
export type VersionedSlug = { readonly slug: string; readonly version: number };
