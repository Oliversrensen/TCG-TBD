import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { createInitialState, applyAction } from "./game/state.js";
import type { GameState, ClientIntent } from "./game/types.js";
import type {
  MatchmakingIntent,
  ServerToClientMessage,
  MsgGameState,
} from "./game/matchmaking-types.js";
import { getOrCreateUserFromNeon } from "./auth/user-repository.js";
import { verifyNeonToken } from "./auth/neon-auth.js";
import { prisma } from "./prisma/client.js";

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
   /** Optional authenticated user identity (from JWT). */
  userId?: string;
  username?: string;
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
  const opp0 = match.sessions[1]?.username ?? "Opponent";
  const opp1 = match.sessions[0]?.username ?? "Opponent";
  if (match.sessions[0]) {
    send(match.sessions[0], { type: "state", state, playerIndex: 0, error, opponentUsername: opp0 });
  }
  if (match.sessions[1]) {
    send(match.sessions[1], { type: "state", state, playerIndex: 1, error, opponentUsername: opp1 });
  }
}

function removeFromQueue(session: Session): void {
  const i = queue.indexOf(session);
  if (i !== -1) queue.splice(i, 1);
  if (session.status === "queued") session.status = "pending";
}

/** True if this user (by userId) already has another session in queue, a lobby, or an active match. */
function isUserAlreadyInMatchmaking(currentSession: Session): boolean {
  const uid = currentSession.userId;
  if (!uid) return false;
  if (queue.some((s) => s !== currentSession && s.userId === uid)) return true;
  for (const lobby of lobbies.values()) {
    if (lobby.creator !== currentSession && lobby.creator.userId === uid) return true;
    if (lobby.joiner && lobby.joiner !== currentSession && lobby.joiner.userId === uid) return true;
  }
  for (const match of matches.values()) {
    if (match.sessions[0] !== currentSession && match.sessions[0].userId === uid) return true;
    if (match.sessions[1] !== currentSession && match.sessions[1].userId === uid) return true;
  }
  return false;
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

  if (s0.userId && s1.userId && s0.userId === s1.userId) {
    queue.push(s0, s1);
    tryMatchFromQueue();
    return;
  }

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

async function handleAuthenticate(session: Session, token: string): Promise<void> {
  const payload = await verifyNeonToken(token);
  if (!payload) {
    send(session, { type: "auth_error", error: "Invalid or expired token" });
    return;
  }
  const username = payload.name ?? payload.email ?? payload.sub;
  try {
    const user = await getOrCreateUserFromNeon(payload.sub, username);
    session.userId = user.id;
    session.username = user.username;
    send(session, { type: "authenticated", userId: user.id, username: user.username });
  } catch (err) {
    console.error("auth getOrCreateUser error", err);
    send(session, { type: "auth_error", error: "Authentication failed" });
  }
}

function handleMatchmaking(session: Session, raw: string): void {
  let intent: MatchmakingIntent;
  try {
    intent = JSON.parse(raw) as MatchmakingIntent;
  } catch {
    send(session, { type: "matchmaking_error", error: "Invalid JSON" });
    return;
  }

  if (intent.type === "authenticate") {
    if (!intent.token) {
      send(session, { type: "auth_error", error: "Missing token" });
      return;
    }
    void handleAuthenticate(session, intent.token);
    return;
  }

  if (intent.type === "join_queue") {
    if (!session.userId) {
      send(session, { type: "matchmaking_error", error: "You must sign in to play." });
      return;
    }
    if (session.status === "queued") {
      send(session, { type: "matchmaking_error", error: "Already in queue." });
      return;
    }
    if (isUserAlreadyInMatchmaking(session)) {
      send(session, { type: "matchmaking_error", error: "You are already in a queue or in a game. Use one window or leave first." });
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
    if (!session.userId) {
      send(session, { type: "matchmaking_error", error: "You must sign in to play." });
      return;
    }
    if (session.status === "in_lobby" && session.lobbyCode) {
      send(session, { type: "matchmaking_error", error: "Already in a lobby. Leave first." });
      return;
    }
    if (isUserAlreadyInMatchmaking(session)) {
      send(session, { type: "matchmaking_error", error: "You are already in a queue or in a game. Use one window or leave first." });
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
    if (!session.userId) {
      send(session, { type: "lobby_error", error: "You must sign in to play." });
      return;
    }
    if (lobby.creator.userId && session.userId && lobby.creator.userId === session.userId) {
      send(session, { type: "lobby_error", error: "You cannot join your own lobby." });
      return;
    }
    if (isUserAlreadyInMatchmaking(session)) {
      send(session, { type: "lobby_error", error: "You are already in a queue or in a game. Use one window or leave first." });
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
    const other = match.sessions[session.playerIndex === 0 ? 1 : 0];
    send(session, { type: "state", state: gameState, playerIndex: session.playerIndex, error: "Invalid JSON", opponentUsername: other?.username ?? "Opponent" });
    return;
  }
  if (gameState.currentTurn !== session.playerIndex) {
    const other = match.sessions[session.playerIndex === 0 ? 1 : 0];
    send(session, { type: "state", state: gameState, playerIndex: session.playerIndex, error: "Not your turn", opponentUsername: other?.username ?? "Opponent" });
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

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
      if (data.length > 1_000_000) {
        // 1MB safety limit
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", (err) => reject(err));
  });
}

async function parseJsonBody<T>(req: IncomingMessage, res: ServerResponse): Promise<T | null> {
  try {
    const text = await readRequestBody(req);
    if (!text) {
      sendJson(res, 400, { error: "Empty body" });
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    sendJson(res, 400, { error: "Invalid JSON" });
    return null;
  }
}

async function getAuthFromRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<{ userId: string; username: string } | null> {
  const authHeader = req.headers["authorization"];
  if (!authHeader || Array.isArray(authHeader)) {
    sendJson(res, 401, { error: "Missing Authorization header" });
    return null;
  }
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    sendJson(res, 401, { error: "Invalid Authorization header" });
    return null;
  }
  const payload = await verifyNeonToken(token);
  if (!payload) {
    sendJson(res, 401, { error: "Invalid or expired token" });
    return null;
  }
  const username = payload.name ?? payload.email ?? payload.sub;
  try {
    const user = await getOrCreateUserFromNeon(payload.sub, username);
    return { userId: user.id, username: user.username };
  } catch (err) {
    console.error("getAuthFromRequest getOrCreateUser error", err);
    sendJson(res, 500, { error: "Authentication failed" });
    return null;
  }
}

async function handleListDecks(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const auth = await getAuthFromRequest(req, res);
  if (!auth) return;
  const decks = await prisma.deck.findMany({
    where: { userId: auth.userId },
    include: { cards: true },
    orderBy: { createdAt: "asc" },
  });
  const payload = decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    cards: deck.cards.map((c) => ({ cardId: c.cardId, count: c.count })),
  }));
  sendJson(res, 200, { decks: payload });
}

async function handleCreateDeck(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const auth = await getAuthFromRequest(req, res);
  if (!auth) return;
  type Body = { name?: string; cards?: { cardId?: string; count?: number }[] };
  const body = await parseJsonBody<Body>(req, res);
  if (!body) return;
  const name = (body.name || "").trim();
  const cards = body.cards ?? [];
  if (!name) {
    sendJson(res, 400, { error: "Deck name is required" });
    return;
  }
  if (cards.length === 0) {
    sendJson(res, 400, { error: "Deck must contain at least one card" });
    return;
  }
  const normalized = cards
    .map((c) => ({
      cardId: (c.cardId || "").trim(),
      count: typeof c.count === "number" ? c.count : 0,
    }))
    .filter((c) => c.cardId && c.count > 0);
  if (normalized.length === 0) {
    sendJson(res, 400, { error: "Deck must contain at least one valid card entry" });
    return;
  }
  const created = await prisma.deck.create({
    data: {
      userId: auth.userId,
      name,
      cards: {
        create: normalized.map((c) => ({
          cardId: c.cardId,
          count: c.count,
        })),
      },
    },
    include: { cards: true },
  });
  sendJson(res, 201, {
    id: created.id,
    name: created.name,
    cards: created.cards.map((c) => ({ cardId: c.cardId, count: c.count })),
  });
}

async function handleUpdateDeck(req: IncomingMessage, res: ServerResponse, deckId: string): Promise<void> {
  const auth = await getAuthFromRequest(req, res);
  if (!auth) return;
  type Body = { name?: string; cards?: { cardId?: string; count?: number }[] };
  const body = await parseJsonBody<Body>(req, res);
  if (!body) return;
  const existing = await prisma.deck.findFirst({
    where: { id: deckId, userId: auth.userId },
  });
  if (!existing) {
    sendJson(res, 404, { error: "Deck not found" });
    return;
  }
  const name = typeof body.name === "string" ? body.name.trim() : existing.name;
  const cards = body.cards;

  await prisma.$transaction(async (tx) => {
    await tx.deck.update({
      where: { id: deckId },
      data: { name },
    });
    if (cards) {
      await tx.deckCard.deleteMany({ where: { deckId } });
      const normalized = cards
        .map((c) => ({
          cardId: (c.cardId || "").trim(),
          count: typeof c.count === "number" ? c.count : 0,
        }))
        .filter((c) => c.cardId && c.count > 0);
      if (normalized.length > 0) {
        await tx.deckCard.createMany({
          data: normalized.map((c) => ({
            deckId,
            cardId: c.cardId,
            count: c.count,
          })),
        });
      }
    }
  });

  const updated = await prisma.deck.findFirst({
    where: { id: deckId, userId: auth.userId },
    include: { cards: true },
  });
  if (!updated) {
    sendJson(res, 404, { error: "Deck not found after update" });
    return;
  }
  sendJson(res, 200, {
    id: updated.id,
    name: updated.name,
    cards: updated.cards.map((c) => ({ cardId: c.cardId, count: c.count })),
  });
}

async function handleDeleteDeck(req: IncomingMessage, res: ServerResponse, deckId: string): Promise<void> {
  const auth = await getAuthFromRequest(req, res);
  if (!auth) return;
  const existing = await prisma.deck.findFirst({
    where: { id: deckId, userId: auth.userId },
  });
  if (!existing) {
    sendJson(res, 404, { error: "Deck not found" });
    return;
  }
  await prisma.deck.delete({ where: { id: deckId } });
  sendJson(res, 204, {});
}

const httpServer = createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request");
    return;
  }

  const { method, url } = req;

  const [path] = url.split("?", 1);

  if (method === "GET" && path === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("TCG server");
    return;
  }

  if (path === "/decks") {
    if (method === "GET") {
      void handleListDecks(req, res);
      return;
    }
    if (method === "POST") {
      void handleCreateDeck(req, res);
      return;
    }
  }

  if (path.startsWith("/decks/")) {
    const deckId = decodeURIComponent(path.slice("/decks/".length));
    if (method === "PUT") {
      void handleUpdateDeck(req, res, deckId);
      return;
    }
    if (method === "DELETE") {
      void handleDeleteDeck(req, res, deckId);
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
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
