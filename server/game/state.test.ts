import { createInitialState, applyAction } from "./state.js";
import type { ClientIntent } from "./types.js";

describe("createInitialState", () => {
  it("creates state with two players, 50 hero health, 10 mana, player 0 turn", () => {
    const s = createInitialState();
    expect(s.currentTurn).toBe(0);
    expect(s.manaRemaining).toBe(10);
    expect(s.winner).toBe(null);
    expect(s.players[0].heroHealth).toBe(50);
    expect(s.players[1].heroHealth).toBe(50);
    expect(s.players[0].hand.length).toBe(5);
    expect(s.players[1].hand.length).toBe(5);
    expect(s.players[0].board).toEqual([]);
    expect(s.players[1].board).toEqual([]);
  });

  it("includes empty persistentEffects array", () => {
    const s = createInitialState();
    expect(s.persistentEffects).toEqual([]);
  });
});

describe("applyAction", () => {
  it("rejects action when not player turn", () => {
    const s = createInitialState();
    const hand0 = s.players[1].hand[0];
    const r = applyAction(s, 1, { type: "play_creature", cardInstanceId: hand0.instanceId });
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toContain("Not your turn");
  });

  it("rejects action when game already over", () => {
    const s = createInitialState();
    s.winner = 0;
    const r = applyAction(s, 0, { type: "end_turn" });
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toContain("Game already over");
  });

  describe("play_creature", () => {
    it("spends mana and moves card to board", () => {
      const s = createInitialState();
      const hand0 = s.players[0].hand[0];
      const r = applyAction(s, 0, { type: "play_creature", cardInstanceId: hand0.instanceId });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players[0].hand.length).toBe(4);
      expect(r.state.players[0].board.length).toBe(1);
      expect(r.state.players[0].board[0].instanceId).toBe(hand0.instanceId);
      expect(r.state.players[0].board[0].currentHealth).toBe(2); // murloc
      expect(r.state.manaRemaining).toBe(9);
    });

    it("rejects when card not in hand", () => {
      const s = createInitialState();
      const r = applyAction(s, 0, { type: "play_creature", cardInstanceId: "fake-id" });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("not in hand");
    });

    it("rejects when card is not a creature (e.g. spell)", () => {
      const s = createInitialState();
      const spell = s.players[0].hand.find((c) => c.cardId === "frostbolt")!;
      const r = applyAction(s, 0, { type: "play_creature", cardInstanceId: spell.instanceId });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("Not a creature");
    });

    it("rejects when not enough mana", () => {
      const s = createInitialState();
      s.manaRemaining = 0;
      const hand0 = s.players[0].hand[0];
      const r = applyAction(s, 0, { type: "play_creature", cardInstanceId: hand0.instanceId });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("Not enough mana");
    });

    it("allows playing expensive creature when mana sufficient", () => {
      const s = createInitialState();
      const dragon = s.players[0].hand.find((c) => c.cardId === "dragon");
      if (!dragon) return; // might not be in fixed hand
      s.players[0].hand.push({ instanceId: "p0-dragon", cardId: "dragon" });
      const r = applyAction(s, 0, { type: "play_creature", cardInstanceId: "p0-dragon" });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.manaRemaining).toBe(3); // 10 - 7
      expect(r.state.players[0].board.some((c) => c.cardId === "dragon")).toBe(true);
    });
  });

  describe("play_spell", () => {
    it("deals damage to enemy hero and sets winner when hero dies", () => {
      let s = createInitialState();
      s.players[1].heroHealth = 6;
      const spell = s.players[0].hand.find((c) => c.cardId === "fireball")!;
      const r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: spell.instanceId,
        targetId: "hero-1",
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players[1].heroHealth).toBe(0);
      expect(r.state.winner).toBe(0);
    });

    it("allows targeting own hero (e.g. for future healing spells)", () => {
      const s = createInitialState();
      s.players[0].heroHealth = 45;
      const spell = s.players[0].hand.find((c) => c.cardId === "frostbolt")!;
      const r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: spell.instanceId,
        targetId: "hero-0",
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players[0].heroHealth).toBe(42); // 45 - 3 damage
    });

    it("rejects when card not in hand", () => {
      const s = createInitialState();
      const r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: "fake",
        targetId: "hero-1",
      });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("not in hand");
    });

    it("rejects when card is not a spell", () => {
      const s = createInitialState();
      const creature = s.players[0].hand[0];
      const r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: creature.instanceId,
        targetId: "hero-1",
      });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("Not a spell");
    });

    it("rejects when not enough mana", () => {
      const s = createInitialState();
      s.manaRemaining = 1;
      const spell = s.players[0].hand.find((c) => c.cardId === "fireball")!;
      const r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: spell.instanceId,
        targetId: "hero-1",
      });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("Not enough mana");
    });

    it("rejects invalid target (non-existent id)", () => {
      const s = createInitialState();
      const spell = s.players[0].hand.find((c) => c.cardId === "frostbolt")!;
      const r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: spell.instanceId,
        targetId: "no-such-target",
      });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("Invalid target");
    });

    it("rejects targeted spell without targetId", () => {
      const s = createInitialState();
      const spell = s.players[0].hand.find((c) => c.cardId === "fireball")!;
      const r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: spell.instanceId,
      });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("target");
    });

    it("arcane intellect: draws 2 cards without target", () => {
      const s = createInitialState();
      s.players[0].hand.push({ instanceId: "p0-ai", cardId: "arcane_intellect" });
      const handSizeBefore = s.players[0].hand.length;
      const deckSizeBefore = s.players[0].deck.length;
      const r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: "p0-ai",
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players[0].hand.length).toBe(handSizeBefore - 1 + 2); // -1 spell +2 drawn
      expect(r.state.players[0].deck.length).toBe(Math.max(0, deckSizeBefore - 2));
    });

    it("animal companion: summons random minion without target", () => {
      const s = createInitialState();
      s.players[0].hand.push({ instanceId: "p0-ac", cardId: "animal_companion" });
      const r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: "p0-ac",
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players[0].board.length).toBe(1);
      const summoned = r.state.players[0].board[0];
      expect(["murloc", "shieldbearer", "ogre"]).toContain(summoned.cardId);
    });

    it("curse of agony: creates persistent effect", () => {
      const s = createInitialState();
      s.players[0].hand.push({ instanceId: "p0-curse", cardId: "curse_of_agony" });
      const r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: "p0-curse",
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.persistentEffects?.length).toBe(1);
      expect(r.state.persistentEffects![0].ownerIndex).toBe(0);
      expect(r.state.persistentEffects![0].turnsRemaining).toBe(3);
      expect(r.state.persistentEffects![0].triggerPhase).toBe("end_of_turn");
    });

    it("persistent effect: deal damage to enemy minions at end of owner turn", () => {
      let s = createInitialState();
      s.players[0].hand.push({ instanceId: "p0-curse", cardId: "curse_of_agony" });
      let r = applyAction(s, 0, { type: "play_spell", cardInstanceId: "p0-curse" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      const p1Murloc = s.players[1].hand.find((c) => c.cardId === "murloc")!;
      r = applyAction(s, 1, { type: "play_creature", cardInstanceId: p1Murloc.instanceId });
      if (!r.ok) return;
      s = r.state;
      expect(s.players[1].board.length).toBe(1);
      r = applyAction(s, 1, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      s.players[0].hand.push({ instanceId: "p0-mur", cardId: "murloc" });
      r = applyAction(s, 0, { type: "play_creature", cardInstanceId: "p0-mur" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      expect(s.players[1].board[0].currentHealth).toBe(1);
      r = applyAction(s, 1, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      expect(s.currentTurn).toBe(1);
      expect(s.players[1].board.length).toBe(0);
    });

    it("deals damage to enemy creature and removes it when health <= 0", () => {
      let s = createInitialState();
      const murloc = s.players[0].hand.find((c) => c.cardId === "murloc")!;
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: murloc.instanceId });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      const enemyMurloc = s.players[1].hand.find((c) => c.cardId === "murloc")!;
      r = applyAction(s, 1, { type: "play_creature", cardInstanceId: enemyMurloc.instanceId });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      const frostbolt = s.players[0].hand.find((c) => c.cardId === "frostbolt")!;
      const targetId = s.players[1].board[0].instanceId;
      r = applyAction(s, 0, {
        type: "play_spell",
        cardInstanceId: frostbolt.instanceId,
        targetId,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players[1].board.length).toBe(0); // 3 damage killed 2-health murloc
    });
  });

  describe("attack", () => {
    it("creature attacks hero, marks attackedThisTurn", () => {
      let s = createInitialState();
      const creature = s.players[0].hand[0];
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: creature.instanceId });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      const boardCreature = s.players[0].board[0];
      r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: boardCreature.instanceId,
        targetId: "hero-1",
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players[1].heroHealth).toBe(49);
      expect(r.state.players[0].board[0].attackedThisTurn).toBe(true);
    });

    it("rejects when attacker not on your board", () => {
      const s = createInitialState();
      const r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: "fake-attacker",
        targetId: "hero-1",
      });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("not on your board");
    });

    it("rejects when creature already attacked this turn", () => {
      let s = createInitialState();
      const creature = s.players[0].hand[0];
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: creature.instanceId });
      if (!r.ok) return;
      s = r.state;
      const boardCreature = s.players[0].board[0];
      r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: boardCreature.instanceId,
        targetId: "hero-1",
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: boardCreature.instanceId,
        targetId: "hero-1",
      });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("Already attacked");
    });

    it("rejects when attacking own hero", () => {
      let s = createInitialState();
      const creature = s.players[0].hand[0];
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: creature.instanceId });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: s.players[0].board[0].instanceId,
        targetId: "hero-0",
      });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("enemy");
    });

    it("rejects invalid target", () => {
      let s = createInitialState();
      const creature = s.players[0].hand[0];
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: creature.instanceId });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: s.players[0].board[0].instanceId,
        targetId: "no-such-id",
      });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("Invalid target");
    });

    it("Taunt: must attack Taunt creature when enemy has one", () => {
      let s = createInitialState();
      const p0Murloc = s.players[0].hand.find((c) => c.cardId === "murloc")!;
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: p0Murloc.instanceId });
      if (!r.ok) return;
      s = r.state;
      // Put a Taunt (Shieldbearer) on enemy board so we must attack it first (still player 0's turn)
      s.players[1].board.push({
        instanceId: "p1-taunt-1",
        cardId: "shieldbearer",
        currentHealth: 4,
        attackedThisTurn: false,
      });
      const attackerId = s.players[0].board[0].instanceId;
      const tauntId = "p1-taunt-1";
      r = applyAction(s, 0, { type: "attack", attackerInstanceId: attackerId, targetId: "hero-1" });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toContain("Taunt");
      r = applyAction(s, 0, { type: "attack", attackerInstanceId: attackerId, targetId: tauntId });
      expect(r.ok).toBe(true);
    });

    it("creature vs creature: both take damage; attacker marked attackedThisTurn", () => {
      let s = createInitialState();
      const p0Murloc = s.players[0].hand.find((c) => c.cardId === "murloc")!;
      const p1Murloc = s.players[1].hand.find((c) => c.cardId === "murloc")!;
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: p0Murloc.instanceId });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, { type: "play_creature", cardInstanceId: p1Murloc.instanceId });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      const p0BoardId = s.players[0].board[0].instanceId;
      const p1BoardId = s.players[1].board[0].instanceId;
      r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: p0BoardId,
        targetId: p1BoardId,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      // Murloc 1/2 vs Murloc 1/2: both deal 1, both have 1 health left
      expect(r.state.players[0].board.length).toBe(1);
      expect(r.state.players[1].board.length).toBe(1);
      expect(r.state.players[0].board[0].currentHealth).toBe(1);
      expect(r.state.players[1].board[0].currentHealth).toBe(1);
      expect(r.state.players[0].board[0].attackedThisTurn).toBe(true);
    });

    it("creature vs creature: target dies when health <= 0", () => {
      let s = createInitialState();
      const p0Ogre = s.players[0].hand.find((c) => c.cardId === "ogre")!;
      const p1Murloc = s.players[1].hand.find((c) => c.cardId === "murloc")!;
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: p0Ogre.instanceId });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, { type: "play_creature", cardInstanceId: p1Murloc.instanceId });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: s.players[0].board[0].instanceId,
        targetId: s.players[1].board[0].instanceId,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      // Ogre 4/4 vs Murloc 1/2: murloc takes 4 (dead), ogre takes 1 (3 health left)
      expect(r.state.players[1].board.length).toBe(0);
      expect(r.state.players[0].board.length).toBe(1);
      expect(r.state.players[0].board[0].currentHealth).toBe(3);
    });

    it("Berserker: gains attack when damaged (on_damage trigger)", () => {
      let s = createInitialState();
      s.players[0].hand.push({ instanceId: "p0-ber", cardId: "berserker" });
      s.players[1].hand.push({ instanceId: "p1-mur", cardId: "murloc" });
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: "p0-ber" });
      if (!r.ok) return;
      s = r.state;
      expect(s.players[0].board[0].attackBuff).toBeUndefined();
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, { type: "play_creature", cardInstanceId: "p1-mur" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, {
        type: "attack",
        attackerInstanceId: s.players[1].board[0].instanceId,
        targetId: s.players[0].board[0].instanceId,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players[0].board[0].attackBuff).toBe(2);
      expect(r.state.players[0].board[0].currentHealth).toBe(2);
    });

    it("Berserker: gains attack after combat exchange (counter-damage uses base attack)", () => {
      let s = createInitialState();
      s.players[0].hand.push({ instanceId: "p0-ber", cardId: "berserker" });
      s.players[1].hand.push({ instanceId: "p1-mur", cardId: "murloc" });
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: "p0-ber" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, { type: "play_creature", cardInstanceId: "p1-mur" });
      if (!r.ok) return;
      s = r.state;
      const berserkerId = s.players[0].board[0].instanceId;
      const murlocId = s.players[1].board[0].instanceId;
      r = applyAction(s, 1, { type: "attack", attackerInstanceId: murlocId, targetId: berserkerId });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players[0].board[0].attackBuff).toBe(2);
      expect(r.state.players[0].board[0].currentHealth).toBe(2);
      expect(r.state.players[1].board.length).toBe(0);
    });

    it("creature vs creature: attacker dies from counter damage", () => {
      let s = createInitialState();
      const p0Murloc = s.players[0].hand.find((c) => c.cardId === "murloc")!;
      const p1Ogre = s.players[1].hand.find((c) => c.cardId === "ogre")!;
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: p0Murloc.instanceId });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, { type: "play_creature", cardInstanceId: p1Ogre.instanceId });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: s.players[0].board[0].instanceId,
        targetId: s.players[1].board[0].instanceId,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      // Murloc 1/2 attacks Ogre 4/4: ogre takes 1 (3 left), murloc takes 4 (dead)
      expect(r.state.players[0].board.length).toBe(0);
      expect(r.state.players[1].board.length).toBe(1);
      expect(r.state.players[1].board[0].currentHealth).toBe(3);
    });
  });

  describe("end_turn", () => {
    it("swaps turn and refills mana", () => {
      let s = createInitialState();
      const r = applyAction(s, 0, { type: "end_turn" });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.currentTurn).toBe(1);
      expect(r.state.manaRemaining).toBe(10);
    });

    it("resets attackedThisTurn for current player's creatures", () => {
      let s = createInitialState();
      const creature = s.players[0].hand[0];
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: creature.instanceId });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: s.players[0].board[0].instanceId,
        targetId: "hero-1",
      });
      if (!r.ok) return;
      s = r.state;
      expect(s.players[0].board[0].attackedThisTurn).toBe(true);
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 1, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      expect(s.currentTurn).toBe(0);
      expect(s.players[0].board[0].attackedThisTurn).toBe(false);
    });
  });

  describe("full game flow", () => {
    it("alternating turns and mana spending work correctly", () => {
      let s = createInitialState();
      const p0M1 = s.players[0].hand[0];
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: p0M1.instanceId });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      expect(s.manaRemaining).toBe(9);
      r = applyAction(s, 0, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      expect(s.currentTurn).toBe(1);
      expect(s.manaRemaining).toBe(10);
      const p1M1 = s.players[1].hand[0];
      r = applyAction(s, 1, { type: "play_creature", cardInstanceId: p1M1.instanceId });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      expect(s.manaRemaining).toBe(9);
      r = applyAction(s, 1, { type: "end_turn" });
      if (!r.ok) return;
      s = r.state;
      expect(s.currentTurn).toBe(0);
      expect(s.manaRemaining).toBe(10);
    });

    it("attack on hero can end game", () => {
      let s = createInitialState();
      s.players[1].heroHealth = 1;
      const creature = s.players[0].hand[0];
      let r = applyAction(s, 0, { type: "play_creature", cardInstanceId: creature.instanceId });
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, 0, {
        type: "attack",
        attackerInstanceId: s.players[0].board[0].instanceId,
        targetId: "hero-1",
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players[1].heroHealth).toBe(0);
      expect(r.state.winner).toBe(0);
    });
  });
});
