# TCG – Development guide (context for agents)

Procedures for common changes. For architecture and “where to change X”, see [ARCHITECTURE.md](./ARCHITECTURE.md). For rules and protocol, see [GAME-RULES.md](./GAME-RULES.md).

---

## 1. Adding a new card

**Single source of truth:** Card definitions exist only on the server. The web client receives card data at build time from a script that reads server definitions. No client can create or alter card templates.

1. **Define the template** in `server/game/cards.ts`:
   - Add an entry to `CARD_TEMPLATES` with `id`, `name`, `type` ("creature" or "spell"), `cost`, and either `attack`/`health` or `spellPower`.
2. **Include it in decks** in `server/game/cards.ts`:
   - Add an entry to `DEFAULT_DECK` (array of `{ cardId, count }`). Order affects draw order: the last entries are drawn first. See "Deck configuration" below.
3. **Regenerate web card data:** From repo root run `node scripts/generate-card-data.mjs` (or build the web app: `cd web && npm run build`, which runs the generator via `prebuild`). The script reads `server/dist/game/cards.js`, so build the server first (`cd server && npm run build`).
4. **Optional:** If the card needs new behaviour (e.g. a keyword like “Taunt”), extend the data model in `server/game/types.ts` and implement the behaviour in `server/game/state.ts` (in the relevant `applyAction` branch or in a shared helper).
5. **Tests:** Add a test in `server/game/state.test.ts` that plays or uses the card and asserts the expected state.
6. **CLI/Web:** No change needed for “play by id”; if you add a new **action type** (not just a new card), see “Adding a new action type” below.

---

## 2. Adding a new action type

1. **Types:** In `server/game/types.ts`, add a new variant to `ClientIntent`, e.g. `| { type: "use_ability"; cardInstanceId: string; targetId: string }`.
2. **Game logic:** In `server/game/state.ts`, add a handler (e.g. `handleUseAbility`) that takes the cloned state, player index, and action; implement validation and state updates; return `ApplyResult`. In `applyAction`, add a `case "use_ability": return handleUseAbility(next, playerIndex, action);` in the switch.
3. **Tests:** Add tests in `server/game/state.test.ts` for success and failure cases.
4. **Protocol docs:** Update `docs/GAME-RULES.md` with the new intent shape and meaning.
5. **CLI:** In `cli/index.js`, extend `parseCommand` to accept a new command (e.g. `ability <id> <targetId>`) and send the new intent.
6. **Web:** In the web client, add UI (button/modal) that sends the new intent when the user confirms.

---

## 3. Adding a keyword (e.g. Taunt)

Keywords are optional `string[]` on card templates and change game rules in specific handlers.

1. **Data:** In `server/game/types.ts`, `CardTemplate` already has optional `keywords?: string[]`. Add the keyword to the template in `server/game/cards.ts` (e.g. `keywords: ["Taunt"]`).
2. **Behaviour:** Implement the rule in the relevant handler in `server/game/state.ts`. For Taunt: in `handleAttack`, before accepting an attack, call `getEnemyCreaturesWithKeyword(state, enemyIndex, "Taunt")`; if the set is non-empty, the target must be one of those instance IDs (cannot attack hero or non-Taunt creatures). Use or add helpers (e.g. `getEnemyCreaturesWithKeyword`) so other keywords can be added similarly.
3. **Generator:** `scripts/generate-card-data.mjs` already emits `keywords` in the generated web `CardTemplate`; no change needed unless you add a new field.
4. **Tests:** Add a test in `server/game/state.test.ts` that sets up a board with an enemy Taunt and asserts that attacking the hero is rejected and attacking the Taunt is allowed.
5. **Web:** The UI can show keywords from `getCardTemplate(id)?.keywords` (e.g. a "Taunt" badge on the card).

---

## 4. Adding a spell effect type (e.g. draw, heal)

Spells currently deal damage via `spellPower`. To add another effect (e.g. "draw 2 cards" or "heal 5"):

1. **Template:** Optionally extend `CardTemplate` in `server/game/types.ts` with an effect descriptor (e.g. `spellEffect?: { type: "damage"; amount: number } | { type: "draw"; count: number }`). If you keep only damage for now, spells without `spellEffect` can continue to use `spellPower` as damage.
2. **Handler:** In `handlePlaySpell` in `server/game/state.ts`, after resolving the spell and target, branch on the effect type: for "damage" (or legacy `spellPower`) call `applyDamageToTarget`; for "draw" use `drawCards` on the appropriate player's hand/deck. Validate target only when relevant (e.g. heal might require a friendly target).
3. **Tests:** Add tests that play the new spell and assert hand size, hero health, etc.
4. **Docs:** Update GAME-RULES.md if the spell effect is user-visible.

---

## 5. Deck configuration

The default deck is defined in `server/game/cards.ts` as `DEFAULT_DECK: { cardId: string; count: number }[]`. To add or remove cards from the default deck, edit this array (e.g. `{ cardId: "shieldbearer", count: 2 }`). Order matters: the list is expanded in order (each cardId repeated `count` times), and players draw from the end of the deck, so the **last** entries in `DEFAULT_DECK` are drawn first. Tests may assume a specific initial hand; if you change the deck, either keep the last 5 drawn cards the same or adjust tests that depend on hand contents.

---

## 6. Changing mana, draw, or hand size

- **Constants:** In `server/game/state.ts`, change `MANA_PER_TURN`, or the draw/hand-size constants (e.g. `MAX_HAND_SIZE`, `INITIAL_DRAW`). If draw logic lives in `cards.ts`, change it there.
- **Draw trigger:** Draw-at-start-of-turn is typically done in the `end_turn` branch in `applyAction`: after switching `currentTurn`, draw one card for the new current player (if deck has cards and hand &lt; max).
- **Tests:** Update or add tests in `state.test.ts` that rely on mana or hand size (e.g. “play two 5-cost cards then end turn” or “draw until hand full”).
- **Docs:** Update `docs/GAME-RULES.md` if the rules summary or constants section changes.

---

## 7. Changing matchmaking (queue, lobby codes)

- **Code:** All matchmaking lives in `server/ws-server.ts`. Current flow: on connect, client is added to a queue; when queue length ≥ 2, two players are popped, `createInitialState()` is called, and state is broadcast. To add lobby codes: maintain a map `lobbyCode → [session, session]`; on connect, client sends `join_lobby { code }` (or similar); if two players in same lobby, start game.
- **Protocol:** If clients must send “join queue” or “join lobby” explicitly, add a new intent (e.g. `join_queue` or `join_lobby`) and document it in GAME-RULES.md. CLI and Web must send that intent after connecting if required.
- **Tests:** Consider an integration test that connects two WebSocket clients, sends join, and asserts they receive game state (see `cli/smoke-test.js` pattern).

---

## 8. Running tests and lint

- **Game core unit tests:** `cd server && npm test` (Jest, `server/game/state.test.ts`).
- **Lint:** Run the project’s lint script if present (e.g. `npm run lint` in server or root). Fix any reported errors before committing.
- **Smoke test:** From repo root, `node run-smoke.js` (starts server on a different port, runs two clients, a few moves). Optional for CI.

---

## 9. Web client: build and env

- **Dev:** `cd web && npm run dev`. Opens a dev server (e.g. Vite). Set `VITE_TCG_SERVER=ws://localhost:8765` (or equivalent) so the client connects to the right backend.
- **Build:** `cd web && npm run build`. Output is in `web/dist`. This runs `generate:cards` first (reads server card definitions and writes `web/src/generated/cardData.ts`). **Build the server before building the web app** so the generator can load `server/dist/game/cards.js`. Serve `web/dist` with any static host; ensure WebSocket URL in production points to your game server.

## 10. Security and persistence

- **Server-authoritative cards:** The server is the only source of card definitions. In `server/game/state.ts`, every intent is validated: `cardInstanceId` and `attackerInstanceId` must exist in the current game state and belong to the acting player; the underlying `cardId` must be in the server catalog (`getCardTemplate`). Clients cannot invent cards or instances.
- **Persistence layer:** `server/repository/` defines interfaces for user collections (e.g. `ICollectionRepository`: getCollection, grantCards, transferCard). The in-memory implementation (`InMemoryCollectionRepository`) is useful for tests and prototypes. The production-ready implementation uses **Postgres + Prisma** (`PrismaCollectionRepository`): see `server/prisma/schema.prisma` and `server/repository/prisma-collection-repository.ts`. Collection/deck features should depend on the repository interface, not on Prisma directly.

---

## 11. Checklist before submitting changes

- [ ] Game logic changes have unit tests in `server/game/state.test.ts`.
- [ ] New intents or message shapes are documented in `docs/GAME-RULES.md`.
- [ ] “Where to change X” and data flow are still accurate in `docs/ARCHITECTURE.md` (or you updated them).
- [ ] README and package scripts (e.g. `npm start`, `npm test`) still work.

---

## 12. Database & migrations (Postgres + Prisma)

- **Local setup:** Use Postgres for development (e.g. Docker: `docker run --name tcg-postgres -e POSTGRES_PASSWORD=tcg -p 5432:5432 -d postgres`). Create a database (e.g. `tcg_dev`). Set `DATABASE_URL` in `server/.env`, e.g. `postgresql://postgres:tcg@localhost:5432/tcg_dev?schema=public`.
- **Prisma schema:** The database schema is defined in `server/prisma/schema.prisma` (models: `User`, `OwnedCard`, `Deck`, `DeckCard`). The Prisma client is created in `server/prisma/client.ts`.
- **Migrations:** From `server/`, run `npx prisma migrate dev --name <change-name>` when you change the schema. In production (e.g. Render), run `npx prisma migrate deploy` or `npx prisma db push` in the build or release step.
- **Generating client:** Prisma Client is generated automatically on `npm install`. If needed, run `cd server && npx prisma generate`.
- **Environment variables:** Set `DATABASE_URL` and `NEON_AUTH_BASE_URL` for the server. The latter is the Neon Auth base URL (from Neon Console → Auth → Configuration); required for JWT verification.

---

## 13. Neon Auth setup

- **Enable Auth:** In your Neon project (same DB as `DATABASE_URL`), open the **Auth** page and click **Enable Auth**. Copy the **Auth Base URL** from the Configuration tab.
- **Server:** Set `NEON_AUTH_BASE_URL=<auth-base-url>` in `server/.env` (no trailing slash). The server uses this to verify JWTs via the JWKS endpoint and does not expose register/login endpoints.
- **Web:** Set `VITE_NEON_AUTH_URL=<auth-base-url>` in `web/.env` (copy from `web/.env.example`). The web client uses this for sign-in/sign-up and to obtain a JWT to send to the game server.
- **CORS:** If the web app is served from a different origin than Neon Auth, ensure Neon Auth allows your app’s origin (Neon Console or auth config).
