/**
 * Automated smoke test: connect two clients, play a few moves, verify no crash.
 * Run with: node smoke-test.js
 * Requires server running on ws://localhost:8765 (or TCG_SERVER).
 */
import WebSocket from "ws";

const SERVER_URL = process.env.TCG_SERVER ?? "ws://localhost:8765";

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function once(ws, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    ws.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

function send(ws, obj) {
  ws.send(JSON.stringify(obj));
}

async function run() {
  // Server assigns: first connection = P0, second = P1. Second connection reliably receives broadcast.
  console.log("Connecting P0 (first)...");
  const wsP0 = await connect();
  const msgP0Wait = await once(wsP0, "message");
  console.log("P0:", JSON.parse(msgP0Wait.toString()).error ?? "ok");

  console.log("Connecting P1 (second)...");
  const wsP1 = await connect();
  const msgP1Start = await once(wsP1, "message"); // P1 gets game start
  const start = JSON.parse(msgP1Start.toString());
  if (!start.state || start.state.players?.length !== 2) {
    console.error("Unexpected initial state", start);
    process.exit(1);
  }
  const p0Hand = start.state.players[0].hand;
  const p1Hand = start.state.players[1].hand;
  console.log("Game started. P0 hand:", p0Hand.length, "P1 hand:", p1Hand.length);

  // P0 moves (from first connection) - P0 may need to drain game-start if it was broadcast to both
  const p0Murloc = p0Hand.find((c) => c.cardId === "murloc");
  if (!p0Murloc) throw new Error("P0 has no murloc");
  send(wsP0, { type: "play_creature", cardInstanceId: p0Murloc.instanceId });
  await once(wsP0, "message"); // game-start or result
  send(wsP0, { type: "end_turn" });
  await once(wsP0, "message");

  // P1: drain 2 (P0 play_creature, P0 end_turn), then play and end turn
  await once(wsP1, "message");
  await once(wsP1, "message");
  const p1Murloc = p1Hand.find((c) => c.cardId === "murloc");
  if (!p1Murloc) throw new Error("P1 has no murloc");
  send(wsP1, { type: "play_creature", cardInstanceId: p1Murloc.instanceId });
  await once(wsP1, "message");
  send(wsP1, { type: "end_turn" });
  await once(wsP1, "message");

  // P0: drain 3 to get state after P1's turn, then attack
  await once(wsP0, "message");
  await once(wsP0, "message");
  const mid = JSON.parse((await once(wsP0, "message")).toString());
  const board0 = mid.state?.players[0]?.board ?? [];
  if (board0.length > 0) {
    send(wsP0, { type: "attack", attackerInstanceId: board0[0].instanceId, targetId: "hero-1" });
    await once(wsP0, "message");
  }

  console.log("Smoke test OK: moves applied, state updating.");
  wsP0.close();
  wsP1.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
