/** Card id → display name. Align with server/game/cards.ts CARD_TEMPLATES. */
export const CARD_NAMES: Record<string, string> = {
  murloc: "Murloc",
  ogre: "Ogre",
  dragon: "Dragon",
  fireball: "Fireball",
  frostbolt: "Frostbolt",
};

export function cardName(cardId: string): string {
  return CARD_NAMES[cardId] ?? cardId;
}
