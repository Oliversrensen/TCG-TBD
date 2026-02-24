# TCG Web Client

Browser client for the TCG game. Uses the same WebSocket protocol as the CLI; see [docs/GAME-RULES.md](../docs/GAME-RULES.md) and [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Setup

```bash
npm install
```

## Run (dev)

```bash
npm run dev
```

Opens at http://localhost:5173. Connect to game server at `ws://localhost:8765` by default. To use another server:

- Create `.env` in `web/` with: `VITE_TCG_SERVER=ws://localhost:8766`
- Or set when running: `VITE_TCG_SERVER=ws://your-server npm run dev`

## Build

```bash
npm run build
```

Output in `dist/`. Serve with any static host; set the WebSocket URL in your deployment (e.g. env or config) so the client points to your game server.

## Where to change

- **Protocol / types:** `src/types.ts` – keep in sync with `server/game/types.ts`.
- **Connection:** `src/useGame.ts` – WebSocket URL, message handling.
- **UI:** `src/App.tsx` – board, hand, buttons; add new intents here when the server supports them.
- **Card names:** `src/cardNames.ts` – add new cards when you add them in `server/game/cards.ts`.
