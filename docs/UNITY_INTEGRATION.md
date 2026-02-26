# Unity Client Integration Sketch

How the existing TCG server can be used as the backend for a Unity frontend.

**For step-by-step setup, see [UNITY_SETUP.md](./UNITY_SETUP.md).** The server stays unchanged; Unity replaces the web client.

## Architecture

```
┌─────────────────┐         WebSocket (JSON)         ┌─────────────────────┐
│  Unity Client   │ ◄──────────────────────────────► │  Existing Server     │
│  (UI + render)  │   ws://host:8765                 │  (ws-server.ts)      │
└─────────────────┘                                  └─────────────────────┘
        │                                                      │
        │  Game logic = server                                 │  Game logic
        │  Unity = presentation only                           │  Matchmaking
        │                                                      │  Auth (Neon)
```

- **Server**: Unchanged. Handles matchmaking, auth, game state, validation.
- **Unity**: Connects via WebSocket, sends intents, receives state, renders it.

---

## Protocol (Same as Web)

### Connection

- **URL**: `ws://localhost:8765` (or your deployed server)
- **Messages**: JSON strings, newline optional
- **Auth**: On connect, send `{"type":"authenticate","token":"<jwt>"}` if the player has a token

### Client → Server (Send)

| Intent | When |
|--------|------|
| `{"type":"authenticate","token":"..."}` | On connect, if logged in |
| `{"type":"join_queue"}` | Find random opponent |
| `{"type":"create_lobby"}` | Host a game |
| `{"type":"join_lobby","code":"ABC123"}` | Join by code |
| `{"type":"leave_queue"}` / `{"type":"leave_lobby"}` | Cancel |
| `{"type":"play_creature","cardInstanceId":"p0-1","boardIndex":2}` | Play minion at slot |
| `{"type":"play_spell","cardInstanceId":"p0-2"}` | No-target spell |
| `{"type":"play_spell","cardInstanceId":"p0-2","targetId":"hero-1"}` | Target spell |
| `{"type":"attack","attackerInstanceId":"p0-5","targetId":"hero-1"}` | Attack |
| `{"type":"end_turn"}` | End turn |

### Server → Client (Receive)

| Message | Meaning |
|---------|---------|
| `{"type":"connected","sessionId":"...","message":"..."}` | Connected |
| `{"type":"authenticated","userId":"...","username":"..."}` | Logged in |
| `{"type":"auth_error","error":"..."}` | Auth failed |
| `{"type":"joined_queue","message":"..."}` | In queue |
| `{"type":"lobby_created","code":"ABC123","message":"..."}` | Host created lobby |
| `{"type":"lobby_joined","code":"...","message":"..."}` | Joined lobby |
| `{"type":"lobby_error","error":"..."}` | Lobby problem |
| `{"type":"state","state":{...},"playerIndex":0,"error":"...","opponentUsername":"..."}` | Game state |

### Game State Shape

```json
{
  "currentTurn": 0,
  "manaRemaining": 10,
  "players": [
    {
      "heroHealth": 50,
      "hand": [{"instanceId":"p0-1","cardId":"murloc"}],
      "board": [{"instanceId":"p0-5","cardId":"ogre","currentHealth":4,"attackedThisTurn":false}],
      "deck": []
    },
    { "heroHealth": 50, "hand": [], "board": [], "deck": [] }
  ],
  "winner": null,
  "lastAction": "0 played Ogre",
  "persistentEffects": []
}
```

- `playerIndex`: 0 = you, 1 = opponent (from your perspective).
- Hand and board use `instanceId` and `cardId`. Use `cardId` to look up card art/stats from your catalog (mirror of `server/game/cards.ts`).

---

## Unity Implementation Outline

### 1. WebSocket

Use a WebSocket client (e.g. [NativeWebSocket](https://github.com/endel/NativeWebSocket) or Unity 2022+ built-in):

```csharp
// Pseudocode
var ws = new WebSocket("ws://localhost:8765");
ws.OnMessage += (bytes) => {
    var json = Encoding.UTF8.GetString(bytes);
    var msg = JsonUtility.FromJson<ServerMessage>(json);
    HandleMessage(msg);
};
ws.Connect();
```

JSON parsing: Unity’s `JsonUtility` works with serializable classes, or use [Newtonsoft.Json](https://docs.unity3d.com/Packages/com.unity.nuget.newtonsoft-json@latest) for more flexibility.

### 2. Auth Token

- Web client uses Neon Auth and stores JWT in `localStorage`.
- Options for Unity:
  - **Web builds**: Use a browser-based login (e.g. OAuth) and pass token to Unity via `Application.ExternalCall` or URL params.
  - **Standalone**: Implement email/password login via Neon Auth REST API, store token in `PlayerPrefs`.

### 3. Screens / Flow

1. **Lobby**: Matchmaking UI – Join Queue, Create Lobby, Join with Code.
2. **In-Game**: Board, hand, hero, mana, turn indicator.
3. **State sync**: On `state` message, update your in-memory `GameState`, then refresh the scene (spawn/move/remove card GameObjects, update numbers).

### 4. Cards & Board

- **Card prefab**: 3D card mesh, script for cost/name/attack/health (from template).
- **Board**: 7 slots per side; positions derived from your layout.
- **Hand**: Fan layout; cards are `GameObject`s that can be picked and dragged.

### 5. Input → Intents

- Play creature: drag from hand to a board slot → `play_creature` with `boardIndex`.
- Play spell: drag to a valid target or “play zone” → `play_spell` with optional `targetId`.
- Attack: select attacker, then target → `attack`.
- End turn: button → `end_turn`.

### 6. Card Catalog

Fetch card definitions at runtime via `GET /card-catalog` (returns `{ cards: CardTemplate[] }`). Alternatively, copy from `server/game/cards.ts` into Unity (ScriptableObjects or a JSON file). Use `cardId` as key for art, cost, stats.

---

## Shared Code Options

To keep protocol in sync:

1. **TypeScript types** (current): Keep `web/src/types.ts` as source of truth; manually mirror in C#.
2. **Codegen**: Run `npm run generate:csharp` to generate C# DTOs from `server/game/types.ts` and `matchmaking-types.ts`. Output: `generated/csharp/TCGDtos.cs`. Copy or symlink into Unity (e.g. `Assets/Scripts/Generated/`).
3. **JSON Schema**: Define a schema, generate TS and C# from it.

---

## Deployment Notes

- **Local**: `ws://localhost:8765` works from Unity Editor and builds.
- **Production**: Use `wss://` and a domain; ensure WebSocket is supported.
- **CORS**: Not relevant for WebSocket (only HTTP).
- **Platforms**: WebSocket works in standalone, editor, mobile, WebGL (with proper client).

---

## Minimal Unity Project Layout

```
Assets/
  Scripts/
    Network/
      WebSocketClient.cs      // Connect, send, receive
      GameClient.cs           // Parse messages, maintain state
    Game/
      GameState.cs            // C# version of GameState
      CardInstance.cs
      GameIntent.cs           // Play, attack, end turn
    UI/
      LobbyUI.cs
      GameUI.cs
      CardController.cs       // Drag, click, display
  Prefabs/
    Card.prefab
    BoardSlot.prefab
  Resources/
    CardCatalog.json          // cardId → art, stats
```

This sketch keeps the server as-is and uses Unity purely for presentation and input.
