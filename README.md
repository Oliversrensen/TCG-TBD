# TCG – Multiplayer card game

Authoritative server, minimal TCG rules: alternating turns, 10 mana, creatures, targeted spells, 50-HP heroes, **deck + draw**. Playable from **CLI** or **browser (React)**. Matchmaking: **join queue** (random) or **create/join lobby** (6-character code).

**For agents and contributors:** See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for where to change behaviour and how the system fits together. **[docs/GAME-RULES.md](docs/GAME-RULES.md)** defines the protocol and data model. **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** explains how to add cards, actions, and run tests.

---

## Quick start

```bash
# From repo root (after npm install at root)
cd server; npm run build; npm start
```

Then either:

- **CLI:** In two other terminals: `node cli/index.js` (or `npm run start:cli` from root).
- **Web:** `cd web; npm install; npm run dev`, open http://localhost:5173 in two tabs (or two browsers).

On PowerShell use `;` between commands. On bash/zsh you can use `&&`.

In the web client: click **Join queue** (or **Create lobby** / **Join lobby** with a code). In the CLI you must send matchmaking intents after connect (see docs). **Auth (optional):** Sign-in and sign-up use **Neon Auth**; set `VITE_NEON_AUTH_URL` in `web/.env` and `NEON_AUTH_BASE_URL` in `server/.env` (see [Neon Auth setup](docs/DEVELOPMENT.md#13-neon-auth-setup)).

---

## Structure

| Path | Purpose |
|------|--------|
| **server/** | Node + TypeScript. Game core (`game/`), WebSocket server, queue + lobby matchmaking. |
| **cli/** | Terminal client. Same protocol as web. |
| **web/** | React + TypeScript browser client. Same protocol as CLI. |
| **docs/** | Architecture, game rules, development guide (context for agents). |

---

## Game rules (short)

- **Turn:** Alternating; 10 mana per turn.
- **Hero:** 50 HP; targetable; 0 = lose.
- **Creatures:** Play from hand (cost); attack once per turn (enemy creature or hero). Combat: both deal damage.
- **Spells:** Cost + spell power; target any creature or hero (including own); deal damage.
- **Deck & draw:** Each player has a deck. Draw 5 at start; draw 1 at start of each turn. Max hand 10.

---

## CLI commands

- `play <handIdx>` – play creature
- `spell <handIdx> <targetId>` – cast spell (target: `hero-0`, `hero-1`, or creature `instanceId`)
- `attack <boardIdx> <targetId>` – attack with board creature
- `end` – end turn

---

## Tests

```bash
cd server; npm test      # Game core unit tests
node run-smoke.js       # From root: starts server, runs two-client smoke test
```

---

## Protocol

- **Matchmaking (before game):** Client sends `join_queue`, `create_lobby`, or `join_lobby` with code; server sends `connected`, `joined_queue`, `lobby_created`, `lobby_joined`, or `state` when the match starts.
- **In game:** Client → Server: `play_creature`, `play_spell`, `attack`, `end_turn`. Server → Client: `{ type: "state", state, playerIndex, error? }`.

Full shapes: [docs/GAME-RULES.md](docs/GAME-RULES.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Troubleshooting

**Port 8765 already in use**

- **PowerShell:** `cd server; $env:PORT=8766; node dist/ws-server.js`  
  CLI: `$env:TCG_SERVER="ws://localhost:8766"; node cli/index.js`  
  Web: set `VITE_TCG_SERVER=ws://localhost:8766` in `web/.env` or when running.
- **Bash:** `PORT=8766 node dist/ws-server.js` and set `TCG_SERVER` / `VITE_TCG_SERVER` for clients.

To free 8765 on Windows: `netstat -ano | findstr :8765`, then `taskkill /PID <pid> /F`.

---

## Hosting the server on Render

The repo includes a **Render Blueprint** so you can deploy the game server in a few steps.

1. **Push the repo to GitHub** (or GitLab/Bitbucket).
2. **Sign in at [render.com](https://render.com)** and go to Dashboard → **New** → **Blueprint**.
3. **Connect the repository** and select it. Render will read `render.yaml` and create a **Web Service** for `tcg-server` (root: `server/`, build: `npm install && npm run build`, start: `npm start`).
4. **Deploy.** Render assigns a URL like `https://tcg-server-xxxx.onrender.com`. The WebSocket URL is the same host with **`wss://`**, e.g. `wss://tcg-server-xxxx.onrender.com`.
5. **Use the hosted server from the web client:**  
   Build the web app with that URL, then serve the build:
   ```bash
   cd web
   set VITE_TCG_SERVER=wss://tcg-server-xxxx.onrender.com
   npm run build
   ```
   (On bash: `VITE_TCG_SERVER=wss://tcg-server-xxxx.onrender.com npm run build`.)  
   Deploy the `web/dist/` folder to any static host (Vercel, Netlify, GitHub Pages, etc.). Users open that site and play against the Render server.

**Note:** On the free tier, Render spins down the service after inactivity; the first request after idle may take 30–60 seconds. Paid plans keep the server always on.

---

## Hosting the server (other options)

You can also host the `server/` app on **Railway, Fly.io, or a VPS**. The server listens on `process.env.PORT` and exposes:

- **HTTP** `GET /` → 200 (health check). No auth endpoints (auth is via Neon Auth).
- **WebSocket** on the same port (connect to `wss://your-host/`). Clients send Neon-issued JWTs with `{ type: "authenticate", token }`; the server verifies them via Neon Auth JWKS.

Point the web client at **`wss://your-host`** at build time:  
`VITE_TCG_SERVER=wss://your-game-server.example.com npm run build` in `web/`, then serve `web/dist/` from any static host.
