import crypto from "crypto";
import { prisma } from "../prisma/client.js";
import type { UserId, OwnedCard, GrantResult, TransferResult } from "./types.js";
import type { ICollectionRepository } from "./collection-repository.js";

export class PrismaCollectionRepository implements ICollectionRepository {
  async getCollection(userId: UserId): Promise<OwnedCard[]> {
    const rows = await prisma.ownedCard.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      instanceId: row.instanceId,
      cardId: row.cardId,
      ownerId: row.ownerId as UserId,
    }));
  }

  async grantCards(userId: UserId, cardIds: string[]): Promise<GrantResult> {
    if (cardIds.length === 0) {
      return { granted: [] };
    }
    const created = await prisma.$transaction(
      cardIds.map((cardId) =>
        prisma.ownedCard.create({
          data: {
            instanceId: this.generateInstanceId(),
            cardId,
            ownerId: userId,
          },
        })
      )
    );
    const granted: OwnedCard[] = created.map((row) => ({
      instanceId: row.instanceId,
      cardId: row.cardId,
      ownerId: row.ownerId as UserId,
    }));
    return { granted };
  }

  async transferCard(instanceId: string, fromUserId: UserId, toUserId: UserId): Promise<TransferResult> {
    const card = await prisma.ownedCard.findUnique({
      where: { instanceId },
    });
    if (!card || card.ownerId !== fromUserId) {
      return { ok: false, error: "Card not owned by from user" };
    }
    await prisma.ownedCard.update({
      where: { instanceId },
      data: { ownerId: toUserId },
    });
    return { ok: true };
  }

  async ownsCard(userId: UserId, instanceId: string): Promise<boolean> {
    const count = await prisma.ownedCard.count({
      where: { ownerId: userId, instanceId },
    });
    return count > 0;
  }

  private generateInstanceId(): string {
    return "col_" + crypto.randomUUID();
  }
}

