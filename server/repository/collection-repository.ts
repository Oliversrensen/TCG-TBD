/**
 * Persistence layer for user card collections.
 * Implementations: in-memory (dev) or DB (production).
 * All mutations go through this layer; server validates and calls repo.
 */

import type { UserId, OwnedCard, GrantResult, TransferResult } from "./types.js";

export interface ICollectionRepository {
  /** Get all cards owned by the user. */
  getCollection(userId: UserId): Promise<OwnedCard[]>;

  /** Grant new card instances to a user (e.g. open pack). Returns the created instances. */
  grantCards(userId: UserId, cardIds: string[]): Promise<GrantResult>;

  /** Transfer one card instance from one user to another (trade/sale). Validates ownership. */
  transferCard(instanceId: string, fromUserId: UserId, toUserId: UserId): Promise<TransferResult>;

  /** Check whether the user owns the given instance. */
  ownsCard(userId: UserId, instanceId: string): Promise<boolean>;
}
