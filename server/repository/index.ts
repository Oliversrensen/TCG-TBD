/**
 * Persistence layer for collections, packs, and trading.
 * Export interfaces and default in-memory implementation.
 * When adding a DB, implement ICollectionRepository against it and wire here.
 */

export type { UserId, OwnedCard, GrantResult, TransferResult } from "./types.js";
export type { ICollectionRepository } from "./collection-repository.js";
export { InMemoryCollectionRepository } from "./in-memory-collection-repository.js";
export { PrismaCollectionRepository } from "./prisma-collection-repository.js";
