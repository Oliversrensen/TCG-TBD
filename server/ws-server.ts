import { createServer } from "http";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { createInitialState, applyAction } from "./game/state.js";
import type { GameState, ClientIntent } from "./game/types.js";
import type {
  MatchmakingIntent,
  ServerToClientMessage,
  MsgGameState,
} from "./game/matchmaking-types.js";

const PORT = Number(process.env.PORT) || 8765;

const LOBBY_CODE_LENGTH = 6;
const LOBBY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0,O,1,I

function generateSessionId(): string {
  return "sess_" + Math.random().toString(36).slice(2, 12);
}

function generateLobbyCode(): string {
  let code = "";
  for (let i = 0; i < LOBBY_CODE_LENGTH; i++) {
    code += LOBBY_CODE_CHARS[Math.floor(Math.random() * LOBBY_CODE_CHARS.length)];
  }
  return code;
}

type SessionStatus = "pending" | "queued" | "in_lobby" | "in_game";

interface Session {
  ws: WebSocket;
  sessionId: string;
  status: SessionStatus;
  playerIndex?: 0 | 1;
  matchId?: string;
  lobbyCode?: string;
}

interface Match {
  gameState: GameState;
  sessions: [Session, Session];
}

const allSessions = new Map<string, Session>();
const queue: Session[] = [];
const lobbies = new Map<string, { creator: Session; joiner?: Session }>();
const matches = new Map<string, Match>();
let matchIdCounter = 0;

function send(session: Session, msg: ServerToClientMessage): void {
  if (session.ws.readyState !== 1) return;
  try {
    session.ws.send(JSON.stringify(msg));
  } catch (err) {
    console.error("send error", session.sessionId, err);
  }
}

function broadcastToMatch(match: Match, state: GameState, error?: string): void {
  if (match.sessions[0]) {
    send(match.sessions[0], { type: "state", state, playerIndex: 0, error });
  }
  if (match.sessions[1]) {
    send(match.sessions[1], { type: "state", state, playerIndex: 1, error });
  }
}

function removeFromQueue(session: Session): void {
  const i = queue.indexOf(session);
  if (i !== -1) queue.splice(i, 1);
  if (session.status === "queued") session.status = "pending";
}

function removeFromLobby(session: Session): void {
  if (!session.lobbyCode) return;
  const lobby = lobbies.get(session.lobbyCode);
  if (lobby) {
    if (lobby.creator === session) {
      if (lobby.joiner) {
        lobby.joiner.status = "pending";
        lobby.joiner.lobbyCode = undefined;
        send(lobby.joiner, { type: "lobby_error", error: "Host left the lobby." });
      }
      lobbies.delete(session.lobbyCode);
    } else if (lobby.joiner === session) {
      lobby.joiner = undefined;
      send(lobby.creator, { type: "lobby_error", error: "Other player left the lobby." });
    }
  }
  session.lobbyCode = undefined;
  session.status = "pending";
}

function endMatch(match: Match, winner: 0 | 1 | null): void {
  const matchId = match.sessions[0]?.matchId ?? match.sessions[1]?.matchId;
  if (match.gameState) {
    match.gameState.winner = winner;
    broadcastToMatch(match, match.gameState);
  }
  match.sessions[0] && (match.sessions[0].status = "pending", match.sessions[0].matchId = undefined, match.sessions[0].playerIndex = undefined);
  match.sessions[1] && (match.sessions[1].status = "pending", match.sessions[1].matchId = undefined, match.sessions[1].playerIndex = undefined);
  if (matchId) matches.delete(matchId);
}

function tryMatchFromQueue(): void {
  if (queue.length < 2) return;
  const s0 = queue.shift()!;
  const s1 = queue.shift()!;
  removeFromQueue(s0);
  removeFromQueue(s1);

  const matchId = "m_" + ++matchIdCounter;
  const gameState = createInitialState();
  s0.status = "in_game";
  s0.playerIndex = 0;
  s0.matchId = matchId;
  s1.status = "in_game";
  s1.playerIndex = 1;
  s1.matchId = matchId;
  const match: Match = { gameState, sessions: [s0, s1] };
  matches.set(matchId, match);
  broadcastToMatch(match, gameState);
}

function handleMatchmaking(session: Session, raw: string): void {
  let intent: MatchmakingIntent;
  try {
    intent = JSON.parse(raw) as MatchmakingIntent;
  } catch {
    send(session, { type: "matchmaking_error", error: "Invalid JSON" });
    return;
  }

  if (intent.type === "join_queue") {
    if (session.status === "queued") {
      send(session, { type: "matchmaking_error", error: "Already in queue." });
      return;
    }
    removeFromLobby(session);
    session.status = "queued";
    session.lobbyCode = undefined;
    queue.push(session);
    send(session, { type: "joined_queue", message: "Waiting for an opponent. You will be matched shortly." });
    tryMatchFromQueue();
    return;
  }

  if (intent.type === "leave_queue") {
    removeFromQueue(session);
    send(session, { type: "left_queue" });
    return;
  }

  if (intent.type === "create_lobby") {
    if (session.status === "in_lobby" && session.lobbyCode) {
      send(session, { type: "matchmaking_error", error: "Already in a lobby. Leave first." });
      return;
    }
    removeFromQueue(session);
    let code = generateLobbyCode();
    while (lobbies.has(code)) code = generateLobbyCode();
    session.status = "in_lobby";
    session.lobbyCode = code;
    lobbies.set(code, { creator: session });
    send(session, { type: "lobby_created", code, message: "Share this code with your friend: " + code });
    return;
  }

  if (intent.type === "join_lobby") {
    const code = (intent.code || "").trim().toUpperCase();
    if (!code || code.length !== LOBBY_CODE_LENGTH) {
      send(session, { type: "lobby_error", error: "Invalid code. Use a 6-character code." });
      return;
    }
    const lobby = lobbies.get(code);
    if (!lobby) {
      send(session, { type: "lobby_error", error: "No lobby with that code. Check the code or create one." });
      return;
    }
    if (lobby.joiner) {
      send(session, { type: "lobby_error", error: "Lobby is full." });
      return;
    }
    removeFromQueue(session);
    lobby.joiner = session;
    session.status = "in_lobby";
    session.lobbyCode = code;
    send(session, { type: "lobby_joined", code, message: "Joined. Starting game when host is ready." });
    send(lobby.creator, { type: "lobby_joined", code, message: "Opponent joined. Starting game." });
    const s0 = lobby.creator;
    const s1 = session;
    const matchId = "m_" + ++matchIdCounter;
    const gameState = createInitialState();
    s0.status = "in_game";
    s0.playerIndex = 0;
    s0.matchId = matchId;
    s0.lobbyCode = undefined;
    s1.status = "in_game";
    s1.playerIndex = 1;
    s1.matchId = matchId;
    s1.lobbyCode = undefined;
    lobbies.delete(code);
    const match: Match = { gameState, sessions: [s0, s1] };
    matches.set(matchId, match);
    broadcastToMatch(match, gameState);
    return;
  }

  if (intent.type === "leave_lobby") {
    removeFromLobby(session);
    return;
  }

  send(session, { type: "matchmaking_error", error: "Unknown action. Send join_queue, create_lobby, or join_lobby." });
}

function handleGameMessage(session: Session, raw: string): void {
  const matchId = session.matchId;
  if (!matchId) return;
  const match = matches.get(matchId);
  if (!match || session.playerIndex === undefined) return;
  const { gameState } = match;
  let intent: ClientIntent;
  try {
    intent = JSON.parse(raw) as ClientIntent;
  } catch {
    send(session, { type: "state", state: gameState, playerIndex: session.playerIndex, error: "Invalid JSON" });
    return;
  }
  if (gameState.currentTurn !== session.playerIndex) {
    send(session, { type: "state", state: gameState, playerIndex: session.playerIndex, error: "Not your turn" });
    return;
  }
  try {
    const result = applyAction(gameState, session.playerIndex, intent);
    if (!result.ok) {
      match.gameState.error = result.error;
      broadcastToMatch(match, match.gameState, result.error);
      return;
    }
    match.gameState = result.state;
    match.gameState.error = undefined;
    broadcastToMatch(match, match.gameState);
    if (match.gameState.winner !== null) {
      endMatch(match, match.gameState.winner);
      matches.delete(matchId);
    }
  } catch (err) {
    console.error("applyAction error:", err);
    broadcastToMatch(match, match.gameState, String(err));
  }
}

function handleDisconnect(session: Session): void {
  allSessions.delete(session.sessionId);
  removeFromQueue(session);
  removeFromLobby(session);
  const matchId = session.matchId;
  if (matchId) {
    const match = matches.get(matchId);
    if (match) {
      const other = match.sessions[1 - (session.playerIndex ?? 0)]!;
      endMatch(match, other.playerIndex ?? null);
      matches.delete(matchId);
    }
    session.matchId = undefined;
    session.playerIndex = undefined;
    session.status = "pending";
  }
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("TCG server");
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws: WebSocket) => {
  const sessionId = generateSessionId();
  const session: Session = {
    ws,
    sessionId,
    status: "pending",
  };
  allSessions.set(sessionId, session);

  send(session, {
    type: "connected",
    sessionId,
    message: "Connected. Send join_queue to find a match, create_lobby to host, or join_lobby with a code.",
  });

  ws.on("message", (data: Buffer) => {
    const raw = data.toString();
    if (session.status === "in_game") {
      handleGameMessage(session, raw);
    } else {
      handleMatchmaking(session, raw);
    }
  });

  ws.on("close", () => handleDisconnect(session));
});

httpServer.listen(PORT, () => {
  console.log("TCG server listening on port " + PORT);
  console.log("HTTP health check: GET / → 200. WebSocket on same port.");
  console.log("Matchmaking: join_queue (random) or create_lobby / join_lobby (code).");
});
