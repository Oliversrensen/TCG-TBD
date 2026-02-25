/** Mirror of server/game/types.ts and matchmaking-types.ts – keep in sync for protocol. */

export interface CardInstance {
  instanceId: string;
  cardId: string;
  currentHealth?: number;
  attackedThisTurn?: boolean;
  attackBuff?: number;
  healthBuff?: number;
}

export interface PersistentEffect {
  id: string;
  ownerIndex: 0 | 1;
  triggerPhase: "start_of_turn" | "end_of_turn";
  turnsRemaining: number;
  effect: Record<string, unknown>;
  sourceCardName?: string;
}

export interface PlayerState {
  heroHealth: number;
  hand: CardInstance[];
  board: CardInstance[];
  deck: CardInstance[];
}

export interface GameState {
  currentTurn: 0 | 1;
  manaRemaining: number;
  players: [PlayerState, PlayerState];
  winner: 0 | 1 | null;
  lastAction?: string;
  error?: string;
  persistentEffects?: PersistentEffect[];
}

export type GameIntent =
  | { type: "play_creature"; cardInstanceId: string; boardIndex?: number }
  | { type: "play_spell"; cardInstanceId: string; targetId?: string }
  | { type: "attack"; attackerInstanceId: string; targetId: string }
  | { type: "end_turn" };

/** Matchmaking/auth intents (send after connect) */
export type MatchmakingIntent =
  | { type: "authenticate"; token: string }
  | { type: "join_queue" }
  | { type: "leave_queue" }
  | { type: "create_lobby" }
  | { type: "join_lobby"; code: string }
  | { type: "leave_lobby" };

/** Server → Client: all message types */
export interface MsgConnected {
  type: "connected";
  sessionId: string;
  message: string;
}

export interface MsgJoinedQueue {
  type: "joined_queue";
  message: string;
}

export interface MsgLeftQueue {
  type: "left_queue";
}

export interface MsgLobbyCreated {
  type: "lobby_created";
  code: string;
  message: string;
}

export interface MsgLobbyJoined {
  type: "lobby_joined";
  code: string;
  message: string;
}

export interface MsgLobbyError {
  type: "lobby_error";
  error: string;
}

export interface MsgMatchmakingError {
  type: "matchmaking_error";
  error: string;
}

export interface MsgAuthenticated {
  type: "authenticated";
  userId: string;
  username: string;
}

export interface MsgAuthError {
  type: "auth_error";
  error: string;
}

export interface MsgGameState {
  type: "state";
  state: GameState;
  playerIndex: 0 | 1;
  error?: string;
  opponentUsername?: string;
}

export type ServerMessage =
  | MsgConnected
  | MsgJoinedQueue
  | MsgLeftQueue
  | MsgLobbyCreated
  | MsgLobbyJoined
  | MsgLobbyError
  | MsgMatchmakingError
  | MsgAuthenticated
  | MsgAuthError
  | MsgGameState;

/** @deprecated use GameIntent */
export type ClientIntent = GameIntent;

/** @deprecated use MsgGameState for in-game state */
export interface ServerMessageLegacy {
  type: "state";
  state: GameState;
  playerIndex?: 0 | 1;
  error?: string;
}
