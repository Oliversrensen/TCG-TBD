import WebSocket from "ws";
import * as readline from "readline";
import { cardLabel } from "./card-names.js";

const SERVER_URL = process.env.TCG_SERVER ?? "ws://localhost:8765";

/** @type {{ type: "state"; state: import("./types.js").GameState; playerIndex?: 0 | 1; error?: string } | null} */
let lastMessage = null;
let rl = null;

function printState(msg) {
  const { state, playerIndex = 0, error } = msg;
  if (error) console.log("\n>>> " + error + "\n");
  const p0 = state.players[0];
  const p1 = state.players[1];
  console.log("---");
  console.log(`Hero 0: ${p0.heroHealth} HP  |  Hero 1: ${p1.heroHealth} HP`);
  console.log(`Mana: ${state.manaRemaining}  |  Turn: Player ${state.currentTurn}`);
  console.log("");
  console.log("Board 0:", p0.board.map((c) => `${c.cardId} hp:${c.currentHealth ?? "?"} (${c.instanceId})`).join(", ") || "(empty)");
  console.log("Board 1:", p1.board.map((c) => `${c.cardId} hp:${c.currentHealth ?? "?"} (${c.instanceId})`).join(", ") || "(empty)");
  const me = state.players[playerIndex];
  const deckCount = Array.isArray(me.deck) ? me.deck.length : 0;
  console.log("");
  console.log("Your hand" + (deckCount > 0 ? ` (deck: ${deckCount})` : "") + ":");
  me.hand.forEach((c, i) => {
    console.log(`  [${i}] ${cardLabel(c.cardId, c.instanceId)}`);
  });
  console.log("---");
  if (state.lastAction) console.log("Last: " + state.lastAction);
  if (state.winner !== null) {
    console.log("\n*** Player " + state.winner + " wins! ***\n");
    process.exit(0);
  }
}

function sendIntent(ws, intent) {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify(intent));
}

function parseCommand(line, state, playerIndex) {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  if (!cmd) return null;
  const me = state.players[playerIndex];
  const hand = me.hand;
  const board = me.board;

  if (cmd === "end") {
    return { type: "end_turn" };
  }
  if (cmd === "play" && parts[1] !== undefined) {
    const i = parseInt(parts[1], 10);
    if (isNaN(i) || i < 0 || i >= hand.length) return null;
    return { type: "play_creature", cardInstanceId: hand[i].instanceId };
  }
  if (cmd === "spell" && parts[1] !== undefined && parts[2] !== undefined) {
    const i = parseInt(parts[1], 10);
    if (isNaN(i) || i < 0 || i >= hand.length) return null;
    const targetId = parts[2];
    return { type: "play_spell", cardInstanceId: hand[i].instanceId, targetId };
  }
  if (cmd === "attack" && parts[1] !== undefined && parts[2] !== undefined) {
    const i = parseInt(parts[1], 10);
    if (isNaN(i) || i < 0 || i >= board.length) return null;
    const targetId = parts[2];
    return { type: "attack", attackerInstanceId: board[i].instanceId, targetId };
  }
  return null;
}

function prompt(ws) {
  if (!rl || !lastMessage?.state) return;
  const state = lastMessage.state;
  const playerIndex = lastMessage.playerIndex ?? 0;
  if (state.winner !== null) return;
  if (state.currentTurn !== playerIndex) {
    console.log("(Waiting for opponent...)");
    return;
  }
  rl.question("> ", (line) => {
    const intent = parseCommand(line, state, playerIndex);
    if (intent) {
      sendIntent(ws, intent);
    } else {
      console.log("Usage: play <handIdx> | spell <handIdx> <targetId> | attack <boardIdx> <targetId> | end");
      console.log("  targetId: hero-0, hero-1, or creature instanceId (e.g. p1-3)");
    }
    prompt(ws);
  });
}

function main() {
  const ws = new WebSocket(SERVER_URL);
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  ws.on("open", () => {
    console.log("Connected. You are Player 0 or 1 (see state). Waiting for game start...\n");
  });

  ws.on("message", (data) => {
    try {
      lastMessage = JSON.parse(data.toString());
      printState(lastMessage);
      prompt(ws);
    } catch (e) {
      console.error("Invalid message:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("Disconnected.");
    rl?.close();
    process.exit(0);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
    process.exit(1);
  });
}

main();
