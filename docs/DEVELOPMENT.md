# TCG – Development guide (context for agents)

Procedures for common changes. For architecture and “where to change X”, see [ARCHITECTURE.md](./ARCHITECTURE.md). For rules and protocol, see [GAME-RULES.md](./GAME-RULES.md).

---

## 1. Adding a new card

1. **Define the template** in `server/game/cards.ts`:
   - Add an entry to `CARD_TEMPLATES` with `id`, `name`, `type` ("creature" or "spell"), `cost`, and either `attack`/`health` or `spellPower`.
2. **Include it in decks** in `server/game/cards.ts`:
   - Update the deck list (e.g. `DECK_CARD_IDS` or whatever `createDeck` uses) so the new card can appear in the deck.
3. **Optional:** If the card needs new behaviour (e.g. a keyword like “Taunt”), extend the data model in `server/game/types.ts` and implement the behaviour in `server/game/state.ts` (in the relevant `applyAction` branch or in a shared helper).
4. **Tests:** Add a test in `server/game/state.test.ts` that plays or uses the card and asserts the expected state.
5. **CLI/Web:** No change needed for “play by id”; if you add a new **action type** (not just a new card), see “Adding a new action type” below.

---

## 2. Adding a new action type

1. **Types:** In `server/game/types.ts`, add a new variant to `ClientIntent`, e.g. `| { type: "use_ability"; cardInstanceId: string; targetId: string }`.
2. **Game logic:** In `server/game/state.ts`, in `applyAction`, add a branch `if (action.type === "use_ability") { ... }`. Validate turn, targets, and state; mutate a clone of state; return `{ ok: true, state: next }` or `{ ok: false, error: "..." }`.
3. **Tests:** Add tests in `server/game/state.test.ts` for success and failure cases.
4. **Protocol docs:** Update `docs/GAME-RULES.md` with the new intent shape and meaning.
5. **CLI:** In `cli/index.js`, extend `parseCommand` to accept a new command (e.g. `ability <id> <targetId>`) and send the new intent.
6. **Web:** In the web client, add UI (button/modal) that sends the new intent when the user confirms.

---

## 3. Changing mana, draw, or hand size

- **Constants:** In `server/game/state.ts`, change `MANA_PER_TURN`, or the draw/hand-size constants (e.g. `MAX_HAND_SIZE`, `INITIAL_DRAW`). If draw logic lives in `cards.ts`, change it there.
- **Draw trigger:** Draw-at-start-of-turn is typically done in the `end_turn` branch in `applyAction`: after switching `currentTurn`, draw one card for the new current player (if deck has cards and hand &lt; max).
- **Tests:** Update or add tests in `state.test.ts` that rely on mana or hand size (e.g. “play two 5-cost cards then end turn” or “draw until hand full”).
- **Docs:** Update `docs/GAME-RULES.md` if the rules summary or constants section changes.

---

## 4. Changing matchmaking (queue, lobby codes)

- **Code:** All matchmaking lives in `server/ws-server.ts`. Current flow: on connect, client is added to a queue; when queue length ≥ 2, two players are popped, `createInitialState()` is called, and state is broadcast. To add lobby codes: maintain a map `lobbyCode → [session, session]`; on connect, client sends `join_lobby { code }` (or similar); if two players in same lobby, start game.
- **Protocol:** If clients must send “join queue” or “join lobby” explicitly, add a new intent (e.g. `join_queue` or `join_lobby`) and document it in GAME-RULES.md. CLI and Web must send that intent after connecting if required.
- **Tests:** Consider an integration test that connects two WebSocket clients, sends join, and asserts they receive game state (see `cli/smoke-test.js` pattern).

---

## 5. Running tests and lint

- **Game core unit tests:** `cd server && npm test` (Jest, `server/game/state.test.ts`).
- **Lint:** Run the project’s lint script if present (e.g. `npm run lint` in server or root). Fix any reported errors before committing.
- **Smoke test:** From repo root, `node run-smoke.js` (starts server on a different port, runs two clients, a few moves). Optional for CI.

---

## 6. Web client: build and env

- **Dev:** `cd web && npm run dev`. Opens a dev server (e.g. Vite). Set `VITE_TCG_SERVER=ws://localhost:8765` (or equivalent) so the client connects to the right backend.
- **Build:** `cd web && npm run build`. Output is in `web/dist`. Serve with any static host; ensure WebSocket URL in production points to your game server.

---

## 7. Checklist before submitting changes

- [ ] Game logic changes have unit tests in `server/game/state.test.ts`.
- [ ] New intents or message shapes are documented in `docs/GAME-RULES.md`.
- [ ] “Where to change X” and data flow are still accurate in `docs/ARCHITECTURE.md` (or you updated them).
- [ ] README and package scripts (e.g. `npm start`, `npm test`) still work.
