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
}

/** Card instance in hand or on board */
export interface CardInstance {
  instanceId: string;
  cardId: string;
  currentHealth?: number;
  attackedThisTurn?: boolean;
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
}

/** Client → Server intents */
export type ClientIntent =
  | { type: "play_creature"; cardInstanceId: string }
  | { type: "play_spell"; cardInstanceId: string; targetId: string }
  | { type: "attack"; attackerInstanceId: string; targetId: string }
  | { type: "end_turn" };

/** Server → Client payload */
export interface ServerMessage {
  type: "state";
  state: GameState;
  playerIndex?: 0 | 1;
  error?: string;
}
