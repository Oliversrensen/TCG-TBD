/**
 * Matchmaking protocol: client intents and server messages before/during a match.
 * Keep in sync with web/src/types.ts matchmaking section.
 */

import type { GameState } from "./types.js";

/** Client → Server: matchmaking/auth intents (send after connect, before or instead of game intents) */
export type MatchmakingIntent =
  | { type: "authenticate"; token: string }
  | { type: "join_queue" }
  | { type: "leave_queue" }
  | { type: "create_lobby" }
  | { type: "join_lobby"; code: string }
  | { type: "leave_lobby" };

/** Server → Client: sent immediately after connection */
export interface MsgConnected {
  type: "connected";
  sessionId: string;
  message: string;
}

/** Server → Client: you are in the queue waiting for an opponent */
export interface MsgJoinedQueue {
  type: "joined_queue";
  message: string;
}

/** Server → Client: you left the queue (e.g. cancelled) */
export interface MsgLeftQueue {
  type: "left_queue";
}

/** Server → Client: lobby created, share code with friend */
export interface MsgLobbyCreated {
  type: "lobby_created";
  code: string;
  message: string;
}

/** Server → Client: you joined a lobby, waiting for host or second player */
export interface MsgLobbyJoined {
  type: "lobby_joined";
  code: string;
  message: string;
}

/** Server → Client: lobby full, invalid code, or left lobby */
export interface MsgLobbyError {
  type: "lobby_error";
  error: string;
}

/** Server → Client: generic matchmaking error (e.g. already in queue) */
export interface MsgMatchmakingError {
  type: "matchmaking_error";
  error: string;
}

/** Server → Client: result of authenticate request */
export interface MsgAuthenticated {
  type: "authenticated";
  userId: string;
  username: string;
}

/** Server → Client: authentication failed */
export interface MsgAuthError {
  type: "auth_error";
  error: string;
}

/** Server → Client: game state (you are in a match) */
export interface MsgGameState {
  type: "state";
  state: GameState;
  playerIndex: 0 | 1;
  error?: string;
  opponentUsername?: string;
}

export type ServerToClientMessage =
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
