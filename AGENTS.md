# Context for AI agents

This repo is a multiplayer TCG (authoritative server, CLI + web clients). Use these files to understand the setup and where to change behaviour. **Context engineering: be precise about locations and contracts.**

1. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** – System overview, repo layout, data flow, **“where to change X”** (rules, cards, matchmaking, new actions). Start here.
2. **[docs/GAME-RULES.md](docs/GAME-RULES.md)** – Game rules, data model (types, state shape), **protocol** (client intents, server messages). Use when implementing or changing client/server contract.
3. **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** – How to add a card, add an action type, change mana/draw, run tests, web build. Procedures for common edits.

**Key locations:**

- Game rules and state transitions: `server/game/state.ts`
- Card definitions and deck: `server/game/cards.ts`
- Types (state, intents, messages): `server/game/types.ts`
- WebSocket server and matchmaking: `server/ws-server.ts`
- CLI commands and display: `cli/index.js`
- Web UI and connection: `web/src/App.tsx`, `web/src/useGame.ts`

Keep protocol and types in sync between `server/game/types.ts` and `web/src/types.ts` (and CLI usage) when adding or changing messages.
