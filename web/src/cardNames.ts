/**
 * Card display names. Derived from server-authoritative card data (generated from server/game/cards.ts).
 */
import { getCardTemplate } from "./cardData";

export function cardName(cardId: string): string {
  return getCardTemplate(cardId)?.name ?? cardId;
}
