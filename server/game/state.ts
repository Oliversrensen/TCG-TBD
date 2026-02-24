import type { GameState, PlayerState, CardInstance, ClientIntent } from "./types.js";
import {
  createDeck,
  drawCards,
  getCardTemplate,
  INITIAL_DRAW,
  MAX_HAND_SIZE,
} from "./cards.js";

const HERO_HEALTH = 50;
const MANA_PER_TURN = 10;

function createPlayerState(deck: CardInstance[]): PlayerState {
  const hand: CardInstance[] = [];
  drawCards(hand, deck, INITIAL_DRAW, MAX_HAND_SIZE);
  return {
    heroHealth: HERO_HEALTH,
    hand,
    board: [],
    deck,
  };
}

/** Create initial game state for a new match. Each player gets a deck and draws INITIAL_DRAW. */
export function createInitialState(): GameState {
  const deck0 = createDeck("p0");
  const deck1 = createDeck("p1");
  return {
    currentTurn: 0,
    manaRemaining: MANA_PER_TURN,
    players: [createPlayerState(deck0), createPlayerState(deck1)],
    winner: null,
  };
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/** Resolve target: returns 'hero', player index, or finds creature on board. */
function resolveTarget(
  state: GameState,
  targetId: string
): { kind: "hero"; playerIndex: 0 | 1 } | { kind: "creature"; playerIndex: 0 | 1; instance: CardInstance } | null {
  if (targetId === "hero-0")
    return { kind: "hero", playerIndex: 0 };
  if (targetId === "hero-1")
    return { kind: "hero", playerIndex: 1 };
  for (const pi of [0, 1] as const) {
    const creature = state.players[pi].board.find((c) => c.instanceId === targetId);
    if (creature) return { kind: "creature", playerIndex: pi, instance: creature };
  }
  return null;
}

/** Apply damage to a target; update state in place (on a clone). Return true if hero died. */
function applyDamageToTarget(
  state: GameState,
  targetId: string,
  damage: number
): boolean {
  const t = resolveTarget(state, targetId);
  if (!t) return false;
  if (t.kind === "hero") {
    const p = state.players[t.playerIndex];
    p.heroHealth = Math.max(0, p.heroHealth - damage);
    return p.heroHealth === 0;
  }
  const board = state.players[t.playerIndex].board;
  const idx = board.findIndex((c) => c.instanceId === targetId);
  if (idx === -1) return false;
  const c = board[idx];
  const newHealth = (c.currentHealth ?? 0) - damage;
  if (newHealth <= 0) board.splice(idx, 1);
  else c.currentHealth = newHealth;
  return false;
}

/** Result of applying an action: new state or error message. */
export type ApplyResult = { ok: true; state: GameState } | { ok: false; error: string };

export function applyAction(
  state: GameState,
  playerIndex: 0 | 1,
  action: ClientIntent
): ApplyResult {
  if (state.winner !== null)
    return { ok: false, error: "Game already over" };
  if (state.currentTurn !== playerIndex)
    return { ok: false, error: "Not your turn" };

  const next = deepClone(state);
  next.error = undefined;
  next.lastAction = undefined;

  if (action.type === "play_creature") {
    const player = next.players[playerIndex];
    const handIdx = player.hand.findIndex((c) => c.instanceId === action.cardInstanceId);
    if (handIdx === -1)
      return { ok: false, error: "Card not in hand" };
    const instance = player.hand[handIdx];
    const template = getCardTemplate(instance.cardId);
    if (!template || template.type !== "creature")
      return { ok: false, error: "Not a creature" };
    if (next.manaRemaining < template.cost)
      return { ok: false, error: "Not enough mana" };
    player.hand.splice(handIdx, 1);
    player.board.push({
      instanceId: instance.instanceId,
      cardId: instance.cardId,
      currentHealth: template.health,
      attackedThisTurn: false,
    });
    next.manaRemaining -= template.cost;
    next.lastAction = `${playerIndex} played ${template.name}`;
    return { ok: true, state: next };
  }

  if (action.type === "play_spell") {
    const player = next.players[playerIndex];
    const handIdx = player.hand.findIndex((c) => c.instanceId === action.cardInstanceId);
    if (handIdx === -1)
      return { ok: false, error: "Card not in hand" };
    const instance = player.hand[handIdx];
    const template = getCardTemplate(instance.cardId);
    if (!template || template.type !== "spell" || template.spellPower == null)
      return { ok: false, error: "Not a spell" };
    if (next.manaRemaining < template.cost)
      return { ok: false, error: "Not enough mana" };
    const target = resolveTarget(next, action.targetId);
    if (!target)
      return { ok: false, error: "Invalid target" };
    player.hand.splice(handIdx, 1);
    next.manaRemaining -= template.cost;
    const heroDied = applyDamageToTarget(next, action.targetId, template.spellPower);
    if (heroDied) next.winner = playerIndex; // you killed opponent's hero
    next.lastAction = `${playerIndex} cast ${template.name} on ${action.targetId}`;
    return { ok: true, state: next };
  }

  if (action.type === "attack") {
    const player = next.players[playerIndex];
    const attacker = player.board.find((c) => c.instanceId === action.attackerInstanceId);
    if (!attacker)
      return { ok: false, error: "Attacker not on your board" };
    if (attacker.attackedThisTurn)
      return { ok: false, error: "Already attacked this turn" };
    const template = getCardTemplate(attacker.cardId);
    if (!template || template.type !== "creature" || template.attack == null)
      return { ok: false, error: "Invalid attacker" };
    const target = resolveTarget(next, action.targetId);
    if (!target)
      return { ok: false, error: "Invalid target" };
    const enemyIndex = 1 - playerIndex;
    if (target.kind === "hero" && target.playerIndex !== enemyIndex)
      return { ok: false, error: "Can only attack enemy hero" };
    if (target.kind === "creature" && target.playerIndex !== enemyIndex)
      return { ok: false, error: "Can only attack enemy creature" };
    const attackDamage = template.attack;
    if (target.kind === "hero") {
      applyDamageToTarget(next, action.targetId, attackDamage);
      if (next.players[enemyIndex].heroHealth <= 0) next.winner = playerIndex;
      const a = player.board.find((c) => c.instanceId === action.attackerInstanceId);
      if (a) a.attackedThisTurn = true;
    } else {
      applyDamageToTarget(next, action.targetId, attackDamage);
      const targetTemplate = getCardTemplate(target.instance.cardId);
      const counterDamage = targetTemplate?.type === "creature" ? (targetTemplate.attack ?? 0) : 0;
      applyDamageToTarget(next, action.attackerInstanceId, counterDamage);
      const stillAlive = player.board.some((c) => c.instanceId === action.attackerInstanceId);
      if (stillAlive) {
        const a = player.board.find((c) => c.instanceId === action.attackerInstanceId)!;
        a.attackedThisTurn = true;
      }
    }
    next.lastAction = `${playerIndex} attacked ${action.targetId}`;
    return { ok: true, state: next };
  }

  if (action.type === "end_turn") {
    next.currentTurn = (1 - playerIndex) as 0 | 1;
    next.manaRemaining = MANA_PER_TURN;
    for (const c of next.players[playerIndex].board) {
      c.attackedThisTurn = false;
    }
    const nextPlayer = next.players[next.currentTurn]!;
    drawCards(nextPlayer.hand, nextPlayer.deck, 1, MAX_HAND_SIZE);
    next.lastAction = `${playerIndex} ended turn`;
    return { ok: true, state: next };
  }

  return { ok: false, error: "Unknown action" };
}
