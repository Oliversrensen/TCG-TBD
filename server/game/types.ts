/** Spell effect type: damage requires a target; draw/summon_random do not. */
export type SpellEffect = "damage" | "draw" | "summon_random" | "create_persistent";

/** Creature trigger: fires when event happens (e.g. on_damage) and applies effect. */
export type TriggerEvent = "on_damage" | "on_attack" | "on_summon" | "on_death";

export type TriggerEffect =
  | { type: "gain_attack"; value: number }
  | { type: "gain_health"; value: number }
  | { type: "heal"; value: number };

export interface Trigger {
  event: TriggerEvent;
  effect: TriggerEffect;
}

/** Card definition (template) */
export interface CardTemplate {
  id: string;
  name: string;
  type: "creature" | "spell";
  cost: number;
  attack?: number;
  health?: number;
  spellPower?: number;
  /** Optional keywords (e.g. "Taunt") that affect game rules. */
  keywords?: string[];
  /** Flavor text (for card styling; not used in game logic). */
  flavorText?: string;
  /** For spells: whether a target is required. Default true for damage spells. */
  requiresTarget?: boolean;
  /** For spells: what the spell does. */
  spellEffect?: SpellEffect;
  /** For spellEffect "draw": number of cards to draw. */
  spellDraw?: number;
  /** For spellEffect "summon_random": optional pool of creature card IDs. */
  spellSummonPool?: string[];
  /** For creatures: trigger effects (e.g. gain attack when hit). */
  triggers?: Trigger[];
  /** For spellEffect "create_persistent": config for the persistent effect. */
  spellPersistent?: SpellPersistentConfig;
}

/** Config for a spell that creates a persistent effect. */
export interface SpellPersistentConfig {
  triggerPhase: "start_of_turn" | "end_of_turn";
  duration: number;
  effect: PersistentEffectPayload;
}

/** Payload for a persistent effect – extensible. */
export type PersistentEffectPayload =
  | { type: "deal_damage_all_enemy_minions"; damage: number }
  | { type: "deal_damage_enemy_hero"; damage: number }
  | { type: "draw_cards"; count: number }
  | { type: "heal_hero"; amount: number }
  | { type: "deal_damage_all_minions"; damage: number }; // both boards

/** Persistent effect active in the game (lives for N turns). */
export interface PersistentEffect {
  id: string;
  ownerIndex: 0 | 1;
  triggerPhase: "start_of_turn" | "end_of_turn";
  turnsRemaining: number;
  effect: PersistentEffectPayload;
  sourceCardName?: string;
}

/** Card instance in hand or on board */
export interface CardInstance {
  instanceId: string;
  cardId: string;
  currentHealth?: number;
  attackedThisTurn?: boolean;
  /** Buffs applied during game (e.g. from triggers). */
  attackBuff?: number;
  healthBuff?: number;
}

/** Per-player state */
export interface PlayerState {
  heroHealth: number;
  hand: CardInstance[];
  board: CardInstance[];
  /** Deck (top = end of array; we draw from the end). Sent to client so they can show deck count. */
  deck: CardInstance[];
}

/** Full game state */
export interface GameState {
  currentTurn: 0 | 1;
  manaRemaining: number;
  players: [PlayerState, PlayerState];
  winner: 0 | 1 | null;
  lastAction?: string;
  error?: string;
  /** Active persistent effects (auras, curses, etc.). */
  persistentEffects?: PersistentEffect[];
}

/** Client → Server intents */
export type ClientIntent =
  | { type: "play_creature"; cardInstanceId: string; boardIndex?: number }
  | { type: "play_spell"; cardInstanceId: string; targetId?: string }
  | { type: "attack"; attackerInstanceId: string; targetId: string }
  | { type: "end_turn" };

/** Server → Client payload */
export interface ServerMessage {
  type: "state";
  state: GameState;
  playerIndex?: 0 | 1;
  error?: string;
}
