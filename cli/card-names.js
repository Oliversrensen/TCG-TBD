/** Card id -> display name for CLI (matches server cards) */
export const CARD_NAMES = {
  murloc: "Murloc",
  ogre: "Ogre",
  dragon: "Dragon",
  fireball: "Fireball",
  frostbolt: "Frostbolt",
};

export function cardLabel(cardId, instanceId) {
  return `${CARD_NAMES[cardId] ?? cardId} (${instanceId})`;
}
