# TCG – Game rules and protocol (context for agents)

This document defines the game rules, data model, and WebSocket protocol. Use it to implement clients or to change server behaviour consistently.

---

## 1. Game rules summary

- **Turn order:** Alternating (Player 0, Player 1, …). One active player per turn.
- **Mana:** Fixed **10** per turn. Spent when playing cards; refills at start of each turn.
- **Hero:** Each player has a hero with **50 health**. Targetable by attacks and spells. At 0 health, that player loses.
- **Creatures:** Have cost, attack, health. Play from hand to board (spend mana). Can attack once per turn (enemy creature or enemy hero). When attacking a creature, both deal damage (attacker’s attack → target, target’s attack → attacker). Creatures at 0 health are removed.
- **Spells:** Have cost and spell power (damage). Require a target: any creature or any hero (including own hero). Spend mana, deal spell power damage to target, spell is discarded.
- **Deck & draw:** Each player has a **deck**. At game start each draws **INITIAL_DRAW** (e.g. 5). At **start of each turn** (after the previous player ended), the active player draws 1 card (if deck has cards and hand size &lt; MAX_HAND_SIZE). **Max hand size** is 10; overdraw is discarded (or not drawn).
- **Win condition:** Reduce the opponent’s hero to 0 health.

---

## 2. Data model (TypeScript)

**Card template** (definition; see `server/game/types.ts` and `cards.ts`):

- `id`, `name`, `type: "creature" | "spell"`, `cost`
- Creature: `attack`, `health`
- Spell: `spellPower`

**Card instance** (in hand, deck, or board):

- `instanceId` (unique per game), `cardId` (references template)
- On board (creatures only): `currentHealth`, `attackedThisTurn`

**Player state:**

- `heroHealth`, `hand: CardInstance[]`, `board: CardInstance[]`, `deck: CardInstance[]` (deck is server-only; may be omitted from client view to hide count)

**Game state:**

- `currentTurn: 0 | 1`, `manaRemaining: number`, `players: [PlayerState, PlayerState]`, `winner: 0 | 1 | null`
- Optional: `lastAction`, `error` (for CLI/UI feedback)

---

## 3. Client → Server (intents)

Every message is a JSON object. Required field: `type`.

### 3.1 Game intents

| type | Other fields | Meaning |
|------|------------------|--------|
| `play_creature` | `cardInstanceId: string` | Play that card from hand to board. |
| `play_spell` | `cardInstanceId: string`, `targetId: string` | Cast spell at target. `targetId` is `"hero-0"`, `"hero-1"`, or a creature’s `instanceId`. |
| `attack` | `attackerInstanceId: string`, `targetId: string` | Creature on your board attacks target (enemy creature or enemy hero). |
| `end_turn` | (none) | End your turn; other player becomes active, mana refills, draw 1 for them. |

### 3.2 Matchmaking and auth intents

These are sent before or instead of game intents.

| type | Other fields | Meaning |
|------|------------------|--------|
| `join_queue` | (none) | Add me to the matchmaking queue; when another player joins, start a match. |
| `leave_queue` | (none) | Leave the matchmaking queue. |
| `create_lobby` | (none) | Create a lobby and receive a 6-character code to share with a friend. |
| `join_lobby` | `code: string` | Join an existing lobby by code; when two players are present, start a match. |
| `leave_lobby` | (none) | Leave the current lobby. |
| `authenticate` | `token: string` | Optional: send a JWT token (from `POST /auth/login` or `/auth/register`) to associate the WebSocket session with a user. The server responds with `authenticated` or `auth_error`. |

---

## 4. Server → Client (messages)

All messages are JSON.

- **On connect:** `{ type: "connected", sessionId: string, message: string }`. `sessionId` is a transient connection id; `message` is a human-readable hint for the client UI.
- **Matchmaking:** `joined_queue`, `left_queue`, `lobby_created`, `lobby_joined`, `lobby_error`, `matchmaking_error` – see `server/game/matchmaking-types.ts` and `web/src/types.ts` for exact shapes. These drive the matchmaking UI (queue status, lobby code, errors).
- **Authentication:**  
  - `{ type: "authenticated", userId: string, username: string }` – JWT was valid; the session is now associated with this user.  
  - `{ type: "auth_error", error: string }` – JWT was invalid or expired; the session remains a guest.
- **During game (or when matched):** `{ type: "state", state: GameState, playerIndex: 0 | 1, error?: string }`. `playerIndex` tells the client which player they are (0 or 1). `error` is set when the last intent was invalid.

---

## 5. Constants (server/game)

- **HERO_HEALTH:** 50  
- **MANA_PER_TURN:** 10  
- **MAX_HAND_SIZE:** 10  
- **INITIAL_DRAW:** 5  
- **Deck composition:** `server/game/cards.ts` – `DEFAULT_DECK` (array of `{ cardId, count }`) and `createDeck()`. The list is expanded in order and cards are drawn from the end of the deck (pop); initial hand is the first 5 cards drawn.

Changing these in one place (state.ts / cards.ts) is enough; document any change here if it affects protocol or balance.

---

## 6. HTTP endpoints (auth and decks)

The same server that hosts WebSockets also exposes simple JSON HTTP endpoints:

- `GET /` → health check (returns `200 OK` and plain text).
- `GET /card-catalog` → returns `{ cards: CardTemplate[] }` for clients (e.g. Unity) to fetch card definitions at runtime. No auth required.
- `POST /auth/register` → body `{ "username": string, "password": string }`  
  Creates a new user (if the username is free) and returns `{ token, userId, username }`. `token` is a JWT signed with `JWT_SECRET` and is used for authenticated calls.
- `POST /auth/login` → body `{ "username": string, "password": string }`  
  Verifies credentials and returns `{ token, userId, username }` on success.
- `GET /decks` → requires `Authorization: Bearer <token>` header. Returns `{ decks: [{ id, name, cards: { cardId, count }[] }] }` for the authenticated user.
- `POST /decks` → requires `Authorization: Bearer <token>`. Body `{ name: string, cards: { cardId: string, count: number }[] }`. Creates a deck for the user.
- `PUT /decks/:id` → requires `Authorization: Bearer <token>`. Updates the deck’s name and/or card list (only for decks owned by the user).
- `DELETE /decks/:id` → requires `Authorization: Bearer <token>`. Deletes a user-owned deck.

At present, matches still use the default deck defined in `server/game/cards.ts`. A future extension can let clients choose a deck and have the server build per-player decks from the `Deck` / `DeckCard` tables when creating a match.
