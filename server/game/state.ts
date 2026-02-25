import type {
  GameState,
  PlayerState,
  CardInstance,
  ClientIntent,
  Trigger,
  TriggerEvent,
  PersistentEffect,
  PersistentEffectPayload,
} from "./types.js";
import {
  createDeck,
  createCardInstance,
  drawCards,
  getCardTemplate,
  CARD_TEMPLATES,
  INITIAL_DRAW,
  MAX_HAND_SIZE,
} from "./cards.js";

const HERO_HEALTH = 50;
const MANA_PER_TURN = 10;

let persistentEffectIdCounter = 0;

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
    persistentEffects: [],
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

/** Run creature triggers for the given event. Mutates state. */
function runCreatureTriggers(
  state: GameState,
  playerIndex: 0 | 1,
  instance: CardInstance,
  event: TriggerEvent
): void {
  const template = getCardTemplate(instance.cardId);
  const triggers = template?.type === "creature" ? (template as { triggers?: Trigger[] }).triggers : undefined;
  if (!triggers) return;
  for (const t of triggers) {
    if (t.event !== event) continue;
    const eff = t.effect;
    if (eff.type === "gain_attack") {
      instance.attackBuff = (instance.attackBuff ?? 0) + eff.value;
    } else if (eff.type === "gain_health") {
      instance.healthBuff = (instance.healthBuff ?? 0) + eff.value;
      instance.currentHealth = (instance.currentHealth ?? 0) + eff.value;
    } else if (eff.type === "heal") {
      const templ = getCardTemplate(instance.cardId);
      const maxHp = (templ?.type === "creature" ? (templ.health ?? 0) : 0) + (instance.healthBuff ?? 0);
      instance.currentHealth = Math.min(maxHp, (instance.currentHealth ?? 0) + eff.value);
    }
  }
}

/** Effective attack for a creature (base + buffs). */
function getEffectiveAttack(template: { attack?: number }, instance: CardInstance): number {
  return (template.attack ?? 0) + (instance.attackBuff ?? 0);
}

/** Apply damage to a target; update state in place. Optionally runs on_damage triggers (default true). Optionally skips removing dead creatures (for combat, so triggers run after exchange). */
function applyDamageToTarget(
  state: GameState,
  targetId: string,
  damage: number,
  runTriggers = true,
  skipSplice = false
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
  c.currentHealth = (c.currentHealth ?? 0) - damage;
  if (runTriggers) runCreatureTriggers(state, t.playerIndex, c, "on_damage");
  if (!skipSplice && (c.currentHealth ?? 0) <= 0) board.splice(idx, 1);
  return false;
}

/** Remove dead creatures from both boards. */
function removeDeadCreatures(state: GameState): void {
  for (const pi of [0, 1] as const) {
    const board = state.players[pi].board;
    for (let i = board.length - 1; i >= 0; i--) {
      if ((board[i].currentHealth ?? 0) <= 0) board.splice(i, 1);
    }
  }
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
  const placed: CardInstance = {
    instanceId: instance.instanceId,
    cardId: instance.cardId,
    currentHealth: template.health,
    attackedThisTurn: false,
  };
  next.players[playerIndex].board.push(placed);
  runCreatureTriggers(next, playerIndex, placed, "on_summon");
  next.manaRemaining -= template.cost;
  next.lastAction = `${playerIndex} played ${template.name}`;
  return { ok: true, state: next };
}

/** Whether this spell needs a target (damage spells). */
function spellRequiresTarget(template: { spellEffect?: string; requiresTarget?: boolean; spellPower?: number }): boolean {
  if (template.requiresTarget === false) return false;
  if (template.spellEffect === "draw" || template.spellEffect === "summon_random" || template.spellEffect === "create_persistent") return false;
  return template.spellPower != null; // damage spell
}

function handlePlaySpell(
  next: GameState,
  playerIndex: 0 | 1,
  action: { type: "play_spell"; cardInstanceId: string; targetId?: string }
): ApplyResult {
  const resolved = getInstanceInState(next, playerIndex, action.cardInstanceId, "hand");
  if (!resolved)
    return { ok: false, error: "Card not in hand or unknown card" };
  const { instance, template } = resolved;
  if (template.type !== "spell")
    return { ok: false, error: "Not a spell" };
  if (next.manaRemaining < template.cost)
    return { ok: false, error: "Not enough mana" };

  const needsTarget = spellRequiresTarget(template);
  if (needsTarget) {
    if (action.targetId == null)
      return { ok: false, error: "This spell requires a target" };
    const target = resolveTarget(next, action.targetId);
    if (!target)
      return { ok: false, error: "Invalid target" };
    if (template.spellPower == null)
      return { ok: false, error: "Not a damage spell" };
    const handIdx = next.players[playerIndex].hand.findIndex((c) => c.instanceId === action.cardInstanceId);
    next.players[playerIndex].hand.splice(handIdx, 1);
    next.manaRemaining -= template.cost;
    const heroDied = applyDamageToTarget(next, action.targetId, template.spellPower);
    if (heroDied) next.winner = playerIndex;
    next.lastAction = `${playerIndex} cast ${template.name} on ${action.targetId}`;
    return { ok: true, state: next };
  }

  // Non-targetable spell: draw or summon_random
  const handIdx = next.players[playerIndex].hand.findIndex((c) => c.instanceId === action.cardInstanceId);
  next.players[playerIndex].hand.splice(handIdx, 1);
  next.manaRemaining -= template.cost;
  const player = next.players[playerIndex];

  if (template.spellEffect === "draw") {
    const count = template.spellDraw ?? 2;
    drawCards(player.hand, player.deck, count, MAX_HAND_SIZE);
    next.lastAction = `${playerIndex} cast ${template.name} (draw ${count})`;
    return { ok: true, state: next };
  }

  if (template.spellEffect === "summon_random") {
    const creatures = CARD_TEMPLATES.filter((c) => c.type === "creature");
    const pool = template.spellSummonPool?.length
      ? template.spellSummonPool
          .map((id) => creatures.find((c) => c.id === id))
          .filter((c): c is NonNullable<typeof c> => c != null)
      : creatures;
    if (pool.length === 0)
      return { ok: false, error: "No valid minion to summon" };
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const prefix = playerIndex === 0 ? "p0" : "p1";
    const summoned = createCardInstance(chosen.id, prefix);
    player.board.push(summoned);
    next.lastAction = `${playerIndex} cast ${template.name} (summoned ${chosen.name})`;
    return { ok: true, state: next };
  }

  if (template.spellEffect === "create_persistent" && template.spellPersistent) {
    const cfg = template.spellPersistent;
    const eff: PersistentEffect = {
      id: `pe-${++persistentEffectIdCounter}`,
      ownerIndex: playerIndex,
      triggerPhase: cfg.triggerPhase,
      turnsRemaining: cfg.duration,
      effect: cfg.effect,
      sourceCardName: template.name,
    };
    if (!next.persistentEffects) next.persistentEffects = [];
    next.persistentEffects.push(eff);
    next.lastAction = `${playerIndex} cast ${template.name} (${cfg.duration} turn effect)`;
    return { ok: true, state: next };
  }

  return { ok: false, error: "Unknown spell effect" };
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
  runCreatureTriggers(next, playerIndex, attacker, "on_attack");
  const attackDamage = getEffectiveAttack(template, attacker);
  if (target.kind === "hero") {
    applyDamageToTarget(next, action.targetId, attackDamage);
    if (next.players[enemyIndex].heroHealth <= 0) next.winner = playerIndex;
    const a = player.board.find((c) => c.instanceId === action.attackerInstanceId);
    if (a) a.attackedThisTurn = true;
  } else {
    applyDamageToTarget(next, action.targetId, attackDamage, false, true);
    const targetTemplate = getCardTemplate(target.instance.cardId);
    const counterDamage = targetTemplate?.type === "creature" ? (targetTemplate.attack ?? 0) : 0;
    applyDamageToTarget(next, action.attackerInstanceId, counterDamage, false, true);
    const targetCreature = next.players[enemyIndex].board.find((c) => c.instanceId === action.targetId);
    const attackerCreature = player.board.find((c) => c.instanceId === action.attackerInstanceId);
    if (targetCreature) runCreatureTriggers(next, enemyIndex, targetCreature, "on_damage");
    if (attackerCreature) runCreatureTriggers(next, playerIndex, attackerCreature, "on_damage");
    removeDeadCreatures(next);
    const stillAlive = player.board.some((c) => c.instanceId === action.attackerInstanceId);
    if (stillAlive) {
      const a = player.board.find((c) => c.instanceId === action.attackerInstanceId)!;
      a.attackedThisTurn = true;
    }
  }
  next.lastAction = `${playerIndex} attacked ${action.targetId}`;
  return { ok: true, state: next };
}

/** Apply a single persistent effect. Mutates state. Returns true if hero died. */
function applyPersistentEffect(state: GameState, effect: PersistentEffect): boolean {
  const owner = effect.ownerIndex;
  const enemy = (1 - owner) as 0 | 1;
  const payload = effect.effect;

  if (payload.type === "deal_damage_all_enemy_minions") {
    for (const c of [...state.players[enemy].board]) {
      applyDamageToTarget(state, c.instanceId, payload.damage);
    }
  } else if (payload.type === "deal_damage_enemy_hero") {
    state.players[enemy].heroHealth = Math.max(0, state.players[enemy].heroHealth - payload.damage);
    if (state.players[enemy].heroHealth === 0) {
      state.winner = owner;
      return true;
    }
  } else if (payload.type === "draw_cards") {
    drawCards(state.players[owner].hand, state.players[owner].deck, payload.count, MAX_HAND_SIZE);
  } else if (payload.type === "heal_hero") {
    state.players[owner].heroHealth = Math.min(HERO_HEALTH, state.players[owner].heroHealth + payload.amount);
  } else if (payload.type === "deal_damage_all_minions") {
    for (const pi of [0, 1] as const) {
      for (const c of [...state.players[pi].board]) {
        applyDamageToTarget(state, c.instanceId, payload.damage);
      }
    }
  }
  return false;
}

/** Process persistent effects for the given player and phase. Mutates state. Returns true if game ended. */
function processPersistentEffects(state: GameState, playerIndex: 0 | 1, phase: "start_of_turn" | "end_of_turn"): boolean {
  const effects = state.persistentEffects ?? [];
  for (const eff of effects) {
    if (eff.ownerIndex !== playerIndex || eff.triggerPhase !== phase) continue;
    if (applyPersistentEffect(state, eff)) return true;
  }
  const list = state.persistentEffects ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const eff = list[i]!;
    if (eff.ownerIndex !== playerIndex || eff.triggerPhase !== phase) continue;
    eff.turnsRemaining--;
    if (eff.turnsRemaining <= 0) list.splice(i, 1);
  }
  return false;
}

function handleEndTurn(next: GameState, playerIndex: 0 | 1): ApplyResult {
  if (processPersistentEffects(next, playerIndex, "end_of_turn")) return { ok: true, state: next };
  next.currentTurn = (1 - playerIndex) as 0 | 1;
  next.manaRemaining = MANA_PER_TURN;
  for (const c of next.players[playerIndex].board) {
    c.attackedThisTurn = false;
  }
  const nextPlayer = next.players[next.currentTurn]!;
  drawCards(nextPlayer.hand, nextPlayer.deck, 1, MAX_HAND_SIZE);
  if (processPersistentEffects(next, next.currentTurn, "start_of_turn")) return { ok: true, state: next };
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
