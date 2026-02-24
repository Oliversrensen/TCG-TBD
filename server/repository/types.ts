/**
 * Types for the persistence layer (collections, packs, trading).
 * When a real DB is added, implement these interfaces against it.
 */

/** Opaque user id (from auth). */
export type UserId = string;

/** A card instance owned by a user. Server-generated instanceId only. */
export interface OwnedCard {
  instanceId: string;
  cardId: string;
  ownerId: UserId;
}

/** Result of granting cards (e.g. opening a pack). */
export interface GrantResult {
  granted: OwnedCard[];
  error?: string;
}

/** Result of a transfer (trade/sale). */
export interface TransferResult {
  ok: boolean;
  error?: string;
}
