/** Auto-generated from server/game/cards.ts. Do not edit by hand. Run: node scripts/generate-card-data.mjs */

export interface CardTemplate {
  id: string;
  name: string;
  type: "creature" | "spell";
  cost: number;
  attack?: number;
  health?: number;
  spellPower?: number;
  keywords?: string[];
}

export const CARD_TEMPLATES: CardTemplate[] =   [
  {
    id: "murloc",
    name: "Murloc",
    type: "creature",
    cost: 1,
    attack: 1,
    health: 2
  },
  {
    id: "shieldbearer",
    name: "Shieldbearer",
    type: "creature",
    cost: 2,
    attack: 0,
    health: 4,
    keywords: [
      "Taunt"
    ]
  },
  {
    id: "ogre",
    name: "Ogre",
    type: "creature",
    cost: 4,
    attack: 4,
    health: 4
  },
  {
    id: "dragon",
    name: "Dragon",
    type: "creature",
    cost: 7,
    attack: 6,
    health: 6
  },
  {
    id: "fireball",
    name: "Fireball",
    type: "spell",
    cost: 4,
    spellPower: 6
  },
  {
    id: "frostbolt",
    name: "Frostbolt",
    type: "spell",
    cost: 2,
    spellPower: 3
  }
];

const byId = new Map(CARD_TEMPLATES.map((c) => [c.id, c]));

export function getCardTemplate(cardId: string): CardTemplate | undefined {
  return byId.get(cardId);
}
