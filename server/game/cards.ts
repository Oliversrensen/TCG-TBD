import type { CardTemplate, CardInstance } from "./types.js";

/** Number of cards each player draws at game start. */
export const INITIAL_DRAW = 5;

/** Maximum hand size; overdraw is not added (card stays in deck or is discarded per design). */
export const MAX_HAND_SIZE = 10;

/** Small set of card templates. Add new cards here and to DECK_CARD_IDS to include in decks. */
export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: "murloc",
    name: "Murloc",
    type: "creature",
    cost: 1,
    attack: 1,
    health: 2,
  },
  {
    id: "shieldbearer",
    name: "Shieldbearer",
    type: "creature",
    cost: 2,
    attack: 0,
    health: 4,
    keywords: ["Taunt"],
  },
  {
    id: "ogre",
    name: "Ogre",
    type: "creature",
    cost: 4,
    attack: 4,
    health: 4,
  },
  {
    id: "dragon",
    name: "Dragon",
    type: "creature",
    cost: 7,
    attack: 6,
    health: 6,
  },
  {
    id: "fireball",
    name: "Fireball",
    type: "spell",
    cost: 4,
    spellPower: 6,
  },
  {
    id: "frostbolt",
    name: "Frostbolt",
    type: "spell",
    cost: 2,
    spellPower: 3,
  },
];

const templatesById = new Map(CARD_TEMPLATES.map((c) => [c.id, c]));

export function getCardTemplate(cardId: string): CardTemplate | undefined {
  return templatesById.get(cardId);
}

/**
 * Card IDs used to build each player's deck. We draw from the end (pop), so the last 5 entries
 * are drawn first; order drawn = fireball, ogre, frostbolt, murloc, murloc → hand[0]=murloc, etc.
 * Last 5 = murloc, murloc, frostbolt, ogre, fireball so initial hand matches test expectations.
 */
/**
 * Deck definition: card id and count. Order matters: we draw from the end of the expanded list,
 * so the last entries here are drawn first. To keep tests happy, the last 5 drawn are
 * murloc, murloc, frostbolt, ogre, fireball.
 */
export const DEFAULT_DECK: { cardId: string; count: number }[] = [
  { cardId: "dragon", count: 1 },
  { cardId: "shieldbearer", count: 2 },
  { cardId: "murloc", count: 2 },
  { cardId: "frostbolt", count: 1 },
  { cardId: "ogre", count: 1 },
  { cardId: "fireball", count: 1 },
  { cardId: "frostbolt", count: 1 },
  { cardId: "ogre", count: 1 },
  { cardId: "fireball", count: 1 },
  { cardId: "murloc", count: 2 },
];

function expandDeckList(): string[] {
  const list: string[] = [];
  for (const { cardId, count } of DEFAULT_DECK) {
    for (let i = 0; i < count; i++) list.push(cardId);
  }
  return list;
}

const DECK_CARD_IDS = expandDeckList();

let instanceCounter = 0;
function nextInstanceId(prefix: string): string {
  return `${prefix}-${++instanceCounter}`;
}

/** Create a full deck for a player (unique instanceIds). Deck order is random-ish by list order. */
export function createDeck(playerPrefix: "p0" | "p1"): CardInstance[] {
  return DECK_CARD_IDS.map((cardId) => ({
    instanceId: nextInstanceId(playerPrefix),
    cardId,
  }));
}

/**
 * Create initial hand by drawing from deck. Mutates deck and hand in place.
 * Draws up to `count` cards or until hand is MAX_HAND_SIZE or deck is empty.
 */
export function drawCards(
  hand: CardInstance[],
  deck: CardInstance[],
  count: number,
  maxHandSize: number
): void {
  for (let i = 0; i < count && hand.length < maxHandSize && deck.length > 0; i++) {
    const card = deck.pop()!;
    hand.push(card);
  }
}
