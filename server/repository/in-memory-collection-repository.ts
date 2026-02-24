/**
 * In-memory implementation of ICollectionRepository.
 * Use for development or until a real DB is wired. Data is lost on restart.
 */

import type { ICollectionRepository } from "./collection-repository.js";
import type { UserId, OwnedCard, GrantResult, TransferResult } from "./types.js";

let instanceCounter = 0;
function nextInstanceId(): string {
  return `coll-${++instanceCounter}`;
}

export class InMemoryCollectionRepository implements ICollectionRepository {
  private store = new Map<UserId, OwnedCard[]>();

  async getCollection(userId: UserId): Promise<OwnedCard[]> {
    return this.store.get(userId) ?? [];
  }

  async grantCards(userId: UserId, cardIds: string[]): Promise<GrantResult> {
    const list = this.store.get(userId) ?? [];
    const granted: OwnedCard[] = [];
    for (const cardId of cardIds) {
      const owned: OwnedCard = {
        instanceId: nextInstanceId(),
        cardId,
        ownerId: userId,
      };
      list.push(owned);
      granted.push(owned);
    }
    this.store.set(userId, list);
    return { granted };
  }

  async transferCard(instanceId: string, fromUserId: UserId, toUserId: UserId): Promise<TransferResult> {
    const fromList = this.store.get(fromUserId);
    if (!fromList) return { ok: false, error: "From user not found" };
    const idx = fromList.findIndex((c) => c.instanceId === instanceId);
    if (idx === -1) return { ok: false, error: "Card not owned by from user" };
    const [card] = fromList.splice(idx, 1);
    card.ownerId = toUserId;
    const toList = this.store.get(toUserId) ?? [];
    toList.push(card);
    this.store.set(toUserId, toList);
    return { ok: true };
  }

  async ownsCard(userId: UserId, instanceId: string): Promise<boolean> {
    const list = this.store.get(userId) ?? [];
    return list.some((c) => c.instanceId === instanceId);
  }
}
