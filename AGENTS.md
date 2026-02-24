# Context for AI agents

This repo is a multiplayer TCG (authoritative server, CLI + web clients). Use these files to understand the setup and where to change behaviour. **Context engineering: be precise about locations and contracts.**

1. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** – System overview, repo layout, data flow, **“where to change X”** (rules, cards, matchmaking, new actions). Start here.
2. **[docs/GAME-RULES.md](docs/GAME-RULES.md)** – Game rules, data model (types, state shape), **protocol** (client intents, server messages). Use when implementing or changing client/server contract.
3. **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** – How to add a card, add an action type, change mana/draw, run tests, web build. Procedures for common edits.

**Key locations:**

- Game rules and state transitions: `server/game/state.ts`
- Card definitions and deck (single source of truth): `server/game/cards.ts` (`CARD_TEMPLATES`, `DEFAULT_DECK`). Web card data is generated at build time by `scripts/generate-card-data.mjs` (run after building the server). Keywords (e.g. Taunt) are optional on templates and implemented in `state.ts` handlers.
- Types (state, intents, messages): `server/game/types.ts`
- Persistence layer (collections, future packs/trading): `server/repository/` – interfaces and in-memory implementation; wire a DB implementation when needed.
- WebSocket server and matchmaking: `server/ws-server.ts`
- CLI commands and display: `cli/index.js`
- Web UI and connection: `web/src/App.tsx`, `web/src/useGame.ts`

**Security:** Card definitions and card instances are server-authoritative. The server validates every intent (instance and cardId must exist and belong to the acting player; cardId must be in the server catalog). Clients never send or invent card data.

Keep protocol and types in sync between `server/game/types.ts` and `web/src/types.ts` (and CLI usage) when adding or changing messages.
