# TCG – Architecture (context for agents)

This document is the primary context for understanding the codebase. Use it to locate where to change behaviour and how pieces connect.

---

## 1. System overview

```
┌─────────────┐     WebSocket (JSON)      ┌──────────────────────────────────────┐
│  CLI / Web  │ ◄────────────────────────►│  Server (Node, ws://localhost:8765)   │
│  clients    │     intents → state       │  - Matchmaking queue                  │
└─────────────┘                           │  - Game state (single match per pair) │
                                          │  - Game core (server/game/)          │
                                          └──────────────────────────────────────┘
```

- **Authority:** Server only. Clients send **intents** (play_creature, play_spell, attack, end_turn). Server validates, applies game logic, broadcasts **full game state** to both players.
- **Security:** The server is the only source of card definitions. Clients never send card templates; they only reference `cardInstanceId` and `cardId` that the server has issued or validated. In `server/game/state.ts`, every intent is validated: instances must exist in the current game state and belong to the acting player; every `cardId` must be in the server catalog. No client can invent cards or instances.
- **Card data:** Card definitions live in `server/game/cards.ts`. The web client receives read-only card data at build time via `scripts/generate-card-data.mjs`, which reads the compiled server output and writes `web/src/generated/cardData.ts`. Build the server before building the web app.
- **Protocol:** WebSocket, one JSON message per frame. See [GAME-RULES.md](./GAME-RULES.md) for message shapes.
- **Persistence:** Matchmaking and active game state are in-memory. A **repository layer** (`server/repository/`) defines interfaces for user collections (getCollection, grantCards, transferCard). Implementations: in-memory (`InMemoryCollectionRepository`) and Postgres+Prisma (`PrismaCollectionRepository`, using `server/prisma/schema.prisma` and `server/prisma/client.ts`). Game rules in `server/game/` stay pure and DB-agnostic.

---

## 2. Repository layout

| Path | Purpose | Where to change… |
|------|---------|-------------------|
| **server/** | Node + TypeScript. WebSocket server + game core. | All game rules, card data, match lifecycle. |
| **server/game/** | Pure game logic (state, actions, cards). No I/O. | **Rules:** `state.ts`. **Card definitions:** `cards.ts` (single source of truth). **Types:** `types.ts`. |
| **server/repository/** | Persistence layer for collections (packs, trading). | **Interfaces:** `ICollectionRepository`. **Default:** in-memory; replace with DB implementation for production. |
| **server/ws-server.ts** | WebSocket server, matchmaking, session → game wiring. | **Matchmaking:** connection handler, queue. **Sending state:** `broadcastState`, `sendTo`. |
| **scripts/generate-card-data.mjs** | Build-time script: reads server card definitions, writes web `generated/cardData.ts`. | Run from repo root after `cd server && npm run build`. |
| **cli/** | Terminal client. Connects to server, prints state, reads commands, sends intents. | **CLI commands:** `index.js` (parseCommand). **Display:** `printState`. |
| **web/** | React + TypeScript browser client. Same protocol as CLI. | **UI:** React components. **Connection:** same WebSocket URL. |
| **docs/** | Architecture, game rules, development guide. | **This file:** architecture and “where to change X”. **GAME-RULES.md:** protocol and data model. **DEVELOPMENT.md:** how to add cards, actions, tests. |

---

## 3. Data flow

1. **Connection:** Client connects to `ws://localhost:8765` (or `PORT` env). Server adds client to **matchmaking queue**.
2. **Match start:** When 2 clients are in the queue, server creates a game (`createInitialState()`), assigns player 0 and 1, sends full state to both.
3. **During game:** Client sends one intent (e.g. `{ type: "play_creature", cardInstanceId: "p0-1" }`). Server calls `applyAction(state, playerIndex, intent)`; if valid, replaces state and **broadcasts** new state to both; if invalid, broadcasts current state + `error`.
4. **End:** When `state.winner !== null` or a client disconnects, match ends; sessions cleared.

---

## 4. Where to change what

- **Add a new card:** Edit `server/game/cards.ts` (CARD_TEMPLATES, and deck list). Then run `node scripts/generate-card-data.mjs` from repo root (or build the web app) so the client gets the new card data. Update types in `types.ts` only if the card has new fields (e.g. new keyword).
- **Change game rules (e.g. mana, draw, damage):** `server/game/state.ts` (constants at top, `applyAction` branches, `createInitialState`).
- **Add a new action type:** (1) `server/game/types.ts` – add to `ClientIntent`. (2) `server/game/state.ts` – handle in `applyAction`. (3) CLI and Web – parse command / add UI and send the new intent shape. (4) Document in GAME-RULES.md and DEVELOPMENT.md.
- **Change matchmaking (e.g. lobby codes, queue timeout):** `server/ws-server.ts` – queue structure, connection handler, when to call `createInitialState()`.
- **Change what the client sees (e.g. hide opponent hand):** Server already sends full state; to hide data, either (a) send a per-player view in `sendTo` (e.g. omit other player’s hand), or (b) keep full state and let the client hide by `playerIndex`. Currently (b); UI uses `playerIndex` to show “your hand” only.
- **Add tests for game logic:** `server/game/state.test.ts`. Test `applyAction` with various states and intents.

---

## 5. Key invariants

- **Single source of truth:** Game state and card definitions live only on the server. Clients never compute next state and never send or invent card data; they only send intents and render received state.
- **Validation:** Every intent is validated: `cardInstanceId`/`attackerInstanceId` must exist in the current game state; every `cardId` must be in the server catalog (`getCardTemplate`). Unknown instances or card IDs are rejected.
- **Game core is pure:** `applyAction(state, playerIndex, intent)` returns `{ ok, state } | { ok: false, error }`. No I/O inside `server/game/`.
- **One active match per pair:** When two players are matched, they share one `gameState` until the game ends or someone disconnects.

---

## 6. Running the system

- **Server:** `cd server && npm run build && npm start` (or `PORT=8766 npm start`). Listens on `PORT` (default 8765).
- **CLI:** `node cli/index.js` (set `TCG_SERVER=ws://localhost:8766` if needed). Two terminals = two players.
- **Web:** `cd web && npm run dev`; open the URL shown (e.g. http://localhost:5173). Configure WebSocket URL via env (see web/README.md).
- **Tests:** `cd server && npm test` (game core unit tests).

See [README.md](../README.md) and [DEVELOPMENT.md](./DEVELOPMENT.md) for more detail.

---

## 7. Authentication and decks

- **Neon Auth:** Authentication is provided by **Neon Auth** (Better Auth). Users sign up and sign in in the web client via Neon Auth (email + password). The server does not implement register/login endpoints; it only verifies JWTs issued by Neon Auth using JWKS (`server/auth/neon-auth.ts`). Enable Auth in your Neon project and set `NEON_AUTH_BASE_URL` (server) and `VITE_NEON_AUTH_URL` (web). See docs and `web/.env.example` for setup.
- **JWT tokens:** JWTs are issued by Neon Auth. The server verifies them via the Neon Auth JWKS endpoint and extracts `sub` (user id) and optional `name`/`email`. Tokens are used for HTTP-protected routes (e.g. `/decks`) via `Authorization: Bearer <token>` and for WebSocket authentication.
- **User sync:** On successful token verification, the server ensures a local `User` row exists (`server/auth/user-repository.ts`: `getOrCreateUserFromNeon`) so that decks and owned cards are keyed by the same user id. The `User` model has `id` (Neon user id) and `username` (display name from Neon).
- **WebSocket auth:** After connecting, clients may send `{ type: "authenticate", token }` as a matchmaking intent (token from Neon Auth). On success the server sets `session.userId` / `session.username` and replies with `{ type: "authenticated", userId, username }`. On failure it replies `{ type: "auth_error", error }`. Sessions without `authenticate` remain guests and can still play matches. The client re-sends the stored token on reconnect when available.
- **Deck API:** Authenticated users can manage decks via HTTP:
  - `GET /decks` → `{ decks: [{ id, name, cards: { cardId, count }[] }] }`
  - `POST /decks` → create a deck for the current user.
  - `PUT /decks/:id` → update name and card list for a user-owned deck.
  - `DELETE /decks/:id` → delete a user-owned deck.
  These are backed by the `Deck` and `DeckCard` models in the Prisma schema. Game start currently still uses the default deck; future work can load a chosen deck and feed it into `createDeck`.
