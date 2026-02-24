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

/**
 * Security: Validate that a card instance exists in state and its cardId is in the server catalog.
 * Rejects client-supplied instance IDs that don't exist or reference unknown cards.
 */
function getInstanceInState(
  state: GameState,
  playerIndex: 0 | 1,
  instanceId: string,
  location: "hand" | "board"
): { instance: CardInstance; template: NonNullable<ReturnType<typeof getCardTemplate>> } | null {
  const player = state.players[playerIndex];
  const list = location === "hand" ? player.hand : player.board;
  const instance = list.find((c) => c.instanceId === instanceId);
  if (!instance) return null;
  const template = getCardTemplate(instance.cardId);
  if (!template) return null; // unknown card id – not in server catalog
  return { instance, template };
}

/** Resolve target: returns 'hero', player index, or finds creature on board. Validates creature cardIds are in catalog. */
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
    if (creature) {
      if (!getCardTemplate(creature.cardId)) return null; // unknown card id
      return { kind: "creature", playerIndex: pi, instance: creature };
    }
  }
  return null;
}

/** Returns instance IDs of enemy creatures that have the given keyword (e.g. "Taunt"). */
function getEnemyCreaturesWithKeyword(state: GameState, enemyIndex: 0 | 1, keyword: string): Set<string> {
  const set = new Set<string>();
  for (const c of state.players[enemyIndex].board) {
    const t = getCardTemplate(c.cardId);
    if (t?.keywords?.includes(keyword)) set.add(c.instanceId);
  }
  return set;
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

function handlePlayCreature(
  next: GameState,
  playerIndex: 0 | 1,
  action: { type: "play_creature"; cardInstanceId: string }
): ApplyResult {
  const resolved = getInstanceInState(next, playerIndex, action.cardInstanceId, "hand");
  if (!resolved)
    return { ok: false, error: "Card not in hand or unknown card" };
  const { instance, template } = resolved;
  if (template.type !== "creature")
    return { ok: false, error: "Not a creature" };
  if (next.manaRemaining < template.cost)
    return { ok: false, error: "Not enough mana" };
  const handIdx = next.players[playerIndex].hand.findIndex((c) => c.instanceId === action.cardInstanceId);
  next.players[playerIndex].hand.splice(handIdx, 1);
  next.players[playerIndex].board.push({
    instanceId: instance.instanceId,
    cardId: instance.cardId,
    currentHealth: template.health,
    attackedThisTurn: false,
  });
  next.manaRemaining -= template.cost;
  next.lastAction = `${playerIndex} played ${template.name}`;
  return { ok: true, state: next };
}

function handlePlaySpell(
  next: GameState,
  playerIndex: 0 | 1,
  action: { type: "play_spell"; cardInstanceId: string; targetId: string }
): ApplyResult {
  const resolved = getInstanceInState(next, playerIndex, action.cardInstanceId, "hand");
  if (!resolved)
    return { ok: false, error: "Card not in hand or unknown card" };
  const { instance, template } = resolved;
  if (template.type !== "spell" || template.spellPower == null)
    return { ok: false, error: "Not a spell" };
  if (next.manaRemaining < template.cost)
    return { ok: false, error: "Not enough mana" };
  const target = resolveTarget(next, action.targetId);
  if (!target)
    return { ok: false, error: "Invalid target" };
  const handIdx = next.players[playerIndex].hand.findIndex((c) => c.instanceId === action.cardInstanceId);
  next.players[playerIndex].hand.splice(handIdx, 1);
  next.manaRemaining -= template.cost;
  const heroDied = applyDamageToTarget(next, action.targetId, template.spellPower);
  if (heroDied) next.winner = playerIndex;
  next.lastAction = `${playerIndex} cast ${template.name} on ${action.targetId}`;
  return { ok: true, state: next };
}

function handleAttack(
  next: GameState,
  playerIndex: 0 | 1,
  action: { type: "attack"; attackerInstanceId: string; targetId: string }
): ApplyResult {
  const resolved = getInstanceInState(next, playerIndex, action.attackerInstanceId, "board");
  if (!resolved)
    return { ok: false, error: "Attacker not on your board or unknown card" };
  const { instance: attacker, template } = resolved;
  if (attacker.attackedThisTurn)
    return { ok: false, error: "Already attacked this turn" };
  if (template.type !== "creature" || template.attack == null)
    return { ok: false, error: "Invalid attacker" };
  const player = next.players[playerIndex];
  const target = resolveTarget(next, action.targetId);
  if (!target)
    return { ok: false, error: "Invalid target" };
  const enemyIndex = (1 - playerIndex) as 0 | 1;
  if (target.kind === "hero" && target.playerIndex !== enemyIndex)
    return { ok: false, error: "Can only attack enemy hero" };
  if (target.kind === "creature" && target.playerIndex !== enemyIndex)
    return { ok: false, error: "Can only attack enemy creature" };
  const enemyTaunts = getEnemyCreaturesWithKeyword(next, enemyIndex, "Taunt");
  if (enemyTaunts.size > 0) {
    if (target.kind === "hero")
      return { ok: false, error: "Must attack a Taunt creature first" };
    if (!enemyTaunts.has(action.targetId))
      return { ok: false, error: "Must attack a Taunt creature first" };
  }
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

function handleEndTurn(next: GameState, playerIndex: 0 | 1): ApplyResult {
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

  switch (action.type) {
    case "play_creature":
      return handlePlayCreature(next, playerIndex, action);
    case "play_spell":
      return handlePlaySpell(next, playerIndex, action);
    case "attack":
      return handleAttack(next, playerIndex, action);
    case "end_turn":
      return handleEndTurn(next, playerIndex);
    default:
      return { ok: false, error: "Unknown action" };
  }
}
