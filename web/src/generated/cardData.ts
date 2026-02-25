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
  flavorText?: string;
  requiresTarget?: boolean;
  spellEffect?: "damage" | "draw" | "summon_random" | "create_persistent";
  spellDraw?: number;
  spellSummonPool?: string[];
  triggers?: { event: string; effect: { type: string; value?: number } }[];
  spellPersistent?: { triggerPhase: string; duration: number; effect: Record<string, unknown> };
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
    id: "berserker",
    name: "Berserker",
    type: "creature",
    cost: 3,
    attack: 2,
    health: 3,
    triggers: [
      {
        event: "on_damage",
        effect: {
          type: "gain_attack",
          value: 2
        }
      }
    ],
    flavorText: "Anger is a gift."
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
    spellPower: 6,
    spellEffect: "damage",
    flavorText: "Fire! Fire! Fire!"
  },
  {
    id: "frostbolt",
    name: "Frostbolt",
    type: "spell",
    cost: 2,
    spellPower: 3,
    spellEffect: "damage",
    flavorText: "Cool as ice."
  },
  {
    id: "arcane_intellect",
    name: "Arcane Intellect",
    type: "spell",
    cost: 3,
    spellEffect: "draw",
    spellDraw: 2,
    requiresTarget: false,
    flavorText: "Knowledge is power."
  },
  {
    id: "animal_companion",
    name: "Animal Companion",
    type: "spell",
    cost: 3,
    spellEffect: "summon_random",
    requiresTarget: false,
    spellSummonPool: [
      "murloc",
      "shieldbearer",
      "ogre"
    ],
    flavorText: "Who's a good boy?"
  },
  {
    id: "curse_of_agony",
    name: "Curse of Agony",
    type: "spell",
    cost: 2,
    spellEffect: "create_persistent",
    requiresTarget: false,
    spellPersistent: {
      triggerPhase: "start_of_turn",
      duration: 3,
      effect: {
        type: "deal_damage_all_enemy_minions",
        damage: 1
      }
    },
    flavorText: "Slow and painful."
  }
];

const byId = new Map(CARD_TEMPLATES.map((c) => [c.id, c]));

export function getCardTemplate(cardId: string): CardTemplate | undefined {
  return byId.get(cardId);
}
