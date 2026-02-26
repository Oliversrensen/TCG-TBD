# Unity TCG Client Setup Guide

This guide explains how to set up the TCG Unity client and where to place scripts in the editor.

---

## Prerequisites

- Unity 2021.3 LTS or later (or 2022+)
- TCG server running (`cd server && npm run build && npm start`)
- Node.js (to run `npm run generate:csharp` if you regenerate DTOs)

---

## 1. Copy the Unity Folder

Copy the entire `unity/` folder from this repo into your Unity project, or create a new Unity project and copy `unity/Assets` and `unity/Packages` into it.

If creating a new project:
- Open Unity Hub > New Project > 2D or 3D (either works)
- Copy `unity/Assets` contents into `Assets/`
- Copy `unity/Packages/manifest.json` and merge with your existing `Packages/manifest.json` (add the `com.unity.nuget.newtonsoft-json` and `com.endel.nativewebsocket` entries)

---

## 2. Package Dependencies

The client requires:

- **Newtonsoft.Json** – Install via Package Manager: Add package by name `com.unity.nuget.newtonsoft-json`
- **NativeWebSocket** – Add package from git URL: `https://github.com/endel/NativeWebSocket.git#upm`

If `unity/Packages/manifest.json` was merged, these should already be present. Otherwise add them in Window > Package Manager.

---

## 3. Script Locations

All scripts live under `Assets/Scripts/`. Use this layout:

| Path | Purpose |
|------|---------|
| `Scripts/TCGConfig.cs` | Config asset (ScriptableObject) |
| `Scripts/GameManager.cs` | Main orchestrator MonoBehaviour |
| `Scripts/Generated/TCGDtos.cs` | Protocol DTOs (from `npm run generate:csharp`) |
| `Scripts/Network/TCGWebSocket.cs` | WebSocket wrapper |
| `Scripts/Network/TCGGameClient.cs` | Connection + state + intents |
| `Scripts/Game/CardCatalog.cs` | Card definitions (fetch from server) |
| `Scripts/Game/CardHelper.cs` | Spell text, effective stats |
| `Scripts/Auth/AuthManager.cs` | Neon Auth login/register |
| `Scripts/UI/LobbyScreen.cs` | Matchmaking UI |
| `Scripts/UI/GameScreen.cs` | In-game board + hand UI |
| `Scripts/UI/CardView.cs` | Card display + actions |
| `Scripts/UI/BoardSlotView.cs` | Board slot drop target |
| `Scripts/UI/CardDragHandler.cs` | Hand card drag |
| `Scripts/UI/HeroTargetButton.cs` | Hero click for spell/attack target |

---

## 4. Create TCGConfig Asset

1. In Project window: Right-click > Create > TCG > Config
2. Name it `TCGConfig`
3. Place in `Assets/Resources/` (or a folder included in Resources) if you want `GameManager` to load it automatically
4. In Inspector set:
   - **Server Ws Url**: `ws://localhost:8765` (or your server URL)
   - **Neon Auth Url**: Your Neon Auth base URL (e.g. `https://xxx.neonauth.region.aws.neon.tech/neondb/auth`) – leave empty if not using auth yet

---

## 5. Scene Setup

### 5.1 GameManager

1. Create an empty GameObject named `GameManager`
2. Add the `GameManager` component
3. In Inspector assign:
   - **Config**: Your TCGConfig asset
   - **Lobby Screen Obj**: The Lobby panel GameObject
   - **Game Screen Obj**: The Game panel GameObject
   - **Connecting Obj**: Optional “Connecting…” panel
   - **Error Obj**: Optional error panel
   - **Error Text**: Optional Text for error message

### 5.2 Lobby Screen

1. Create a Canvas (if needed) and a child Panel named `LobbyScreen`
2. Add the `LobbyScreen` component to it
3. Build the UI:
   - **Auth**: Email/Password inputs, Login/Signup buttons, “Create account” toggle, error text, logged-in label, Logout button
   - **Matchmaking**: Join Queue, Create Lobby, Lobby code input + Join Lobby
   - **Queue**: “Searching…” text, Leave Queue
   - **Lobby**: Lobby code display, status text
4. Assign references in the LobbyScreen Inspector (Config, Client are set by GameManager; Auth is set by GameManager)

### 5.3 Game Screen

1. Create a Panel named `GameScreen`
2. Add the `GameScreen` component
3. Build the UI:
   - **HUD**: Mana text, Turn text, Winner text, Error text, Last action text, End Turn button
   - **Opponent**: Hero name/health, board container (HorizontalLayoutGroup or GridLayoutGroup)
   - **Player**: Hero name/health, board container (7 slots), hand container (HorizontalLayoutGroup)
   - **Targeting**: Hint panel + Cancel button
4. Assign references in GameScreen Inspector

### 5.4 Card Prefab

1. Create a UI Panel (or Image) for the card
2. Add child Text elements: Cost, Name, Stats, Keywords
3. Add `CardView` component
4. Add `CardDragHandler` component (for hand cards)
5. Add Buttons: Play, Attack, Spell Target (can be hidden by CardView based on context)
6. Assign all references in CardView Inspector
7. Save as prefab and assign to GameScreen’s **Card Prefab**

### 5.5 Board Slot Prefab

1. Create a UI Panel (Image with Raycast Target enabled so drops work)
2. Add `BoardSlotView` component
3. Set **Slot Index** in code (GameScreen sets it)
4. Save as prefab and assign to GameScreen’s **Board Slot Prefab**

### 5.6 Hero Targets

1. On each hero display, add a Button (or make the hero panel a Button)
2. Add `HeroTargetButton` component
3. Set **Is Opponent**: true for the opponent's hero, false for your hero
4. Assign **Game Screen** reference

---

## 6. Hierarchy Example

```
Canvas
├── GameManager (with GameManager script)
├── ConnectingPanel
├── ErrorPanel
│   └── ErrorText
├── ReconnectButton (onClick -> GameManager.Reconnect)
├── LobbyScreen (with LobbyScreen script)
│   ├── AuthPanel
│   ├── LoggedInPanel
│   ├── MatchmakingPanel
│   ├── QueuePanel
│   └── LobbyPanel
└── GameScreen (with GameScreen script)
    ├── HUD
    ├── OpponentHero (add HeroTargetButton, isOpponent=true)
    ├── OpponentBoard
    ├── PlayerBoard
    ├── PlayerHero (add HeroTargetButton, isOpponent=false)
    ├── Hand
    ├── EndTurnButton
    └── TargetingHintPanel
```

---

## 7. Running

1. Start the server: `cd server && npm run build && npm start`
2. Press Play in Unity
3. Sign in (if Neon Auth is configured) or use a stored token
4. Join Queue or Create/Join Lobby
5. Play cards by clicking Play or dragging creatures to board slots

---

## 8. Auth (Neon)

Set **Neon Auth Url** in TCGConfig to your Neon Auth base URL. The AuthManager calls:

- `POST {neonAuthUrl}/sign-in/email` – body: `{ email, password }`
- `POST {neonAuthUrl}/sign-up/email` – body: `{ email, password, name }`

If your Neon Auth setup uses different endpoints or response format, adjust `AuthManager.cs` accordingly. The server expects a JWT from Neon Auth; the client sends it via `authenticate` intent after connecting.

---

## 9. Regenerating C# DTOs

When server types change:

```bash
npm run generate:csharp
```

Then copy `generated/csharp/TCGDtos.cs` to `unity/Assets/Scripts/Generated/TCGDtos.cs` (or update the copy in your Unity project).

---

## 10. Troubleshooting

| Issue | Check |
|-------|------|
| "Cannot reach server" | Server running? Correct ws URL in TCGConfig? |
| "Sign in to play" | Neon Auth URL set? Login works in web client? |
| Cards not showing | Card catalog loads from GET /card-catalog – server must be up before Play |
| Drop not working | Board slot has an Image (or other Graphic) with Raycast Target enabled |
| Compilation errors | Newtonsoft.Json and NativeWebSocket packages installed? |
