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

| type | Other fields | Meaning |
|------|------------------|--------|
| `join_queue` | (none) | Add me to matchmaking; respond with `waiting` or game state when matched. |
| `play_creature` | `cardInstanceId: string` | Play that card from hand to board. |
| `play_spell` | `cardInstanceId: string`, `targetId: string` | Cast spell at target. `targetId` is `"hero-0"`, `"hero-1"`, or a creature’s `instanceId`. |
| `attack` | `attackerInstanceId: string`, `targetId: string` | Creature on your board attacks target (enemy creature or enemy hero). |
| `end_turn` | (none) | End your turn; other player becomes active, mana refills, draw 1 for them. |

---

## 4. Server → Client (messages)

All messages are JSON.

- **During game (or when matched):** `{ type: "state", state: GameState, playerIndex?: 0 | 1, error?: string }`. `playerIndex` tells the client which player they are (0 or 1). `error` is set when the last intent was invalid.
- **Waiting for match:** Same shape, with a placeholder state and `error: "Waiting for opponent..."` (or similar).

---

## 5. Constants (server/game)

- **HERO_HEALTH:** 50  
- **MANA_PER_TURN:** 10  
- **MAX_HAND_SIZE:** 10  
- **INITIAL_DRAW:** 5  
- **Deck composition:** `server/game/cards.ts` – `DECK_CARD_IDS`, `createDeck()`. Draw is from end of deck (pop); initial hand = first 5 drawn.

Changing these in one place (state.ts / cards.ts) is enough; document any change here if it affects protocol or balance.
