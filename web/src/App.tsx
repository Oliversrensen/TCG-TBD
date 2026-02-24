import { useState } from "react";
import { useGame } from "./useGame";
import { cardName } from "./cardNames";
import type { PlayerState, CardInstance } from "./types";

function HeroBlock({ label, health }: { label: string; health: number }) {
  return (
    <div style={{ padding: 8, background: "#1a1a2e", borderRadius: 8 }}>
      <div style={{ fontSize: 12, color: "#aaa" }}>{label}</div>
      <div style={{ fontSize: 24 }}>❤️ {health}</div>
    </div>
  );
}

function Board({ player, label }: { player: PlayerState; label: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 60 }}>
        {player.board.length === 0 && (
          <span style={{ color: "#666" }}>No creatures</span>
        )}
        {player.board.map((c) => (
          <div
            key={c.instanceId}
            style={{
              padding: "8px 12px",
              background: "#16213e",
              borderRadius: 8,
              border: "1px solid #333",
            }}
          >
            <div>{cardName(c.cardId)}</div>
            <div style={{ fontSize: 12, color: "#888" }}>
              HP: {c.currentHealth ?? "?"}
              {c.attackedThisTurn && " • Attacked"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HandCard({
  card,
  canPlay,
  onPlayCreature,
  onPlaySpell,
  targetIds,
}: {
  card: CardInstance;
  canPlay: boolean;
  onPlayCreature: (id: string) => void;
  onPlaySpell: (id: string, targetId: string) => void;
  targetIds: string[];
}) {
  const name = cardName(card.cardId);
  const isCreature = ["murloc", "ogre", "dragon"].includes(card.cardId);
  const isSpell = ["fireball", "frostbolt"].includes(card.cardId);

  return (
    <div
      style={{
        padding: "8px 12px",
        background: canPlay ? "#16213e" : "#111",
        borderRadius: 8,
        border: "1px solid #333",
      }}
    >
      <div>{name}</div>
      {canPlay && isCreature && (
        <button type="button" onClick={() => onPlayCreature(card.instanceId)} style={{ marginTop: 4 }}>
          Play
        </button>
      )}
      {canPlay && isSpell && (
        <div style={{ marginTop: 4, fontSize: 11 }}>
          Target:{" "}
          {targetIds.map((tid) => (
            <button
              key={tid}
              type="button"
              onClick={() => onPlaySpell(card.instanceId, tid)}
              style={{ marginRight: 4 }}
            >
              {tid}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardCreature({
  card,
  canAttack,
  onAttack,
  targetIds,
}: {
  card: CardInstance;
  canAttack: boolean;
  onAttack: (attackerId: string, targetId: string) => void;
  targetIds: string[];
}) {
  const name = cardName(card.cardId);
  const attacked = card.attackedThisTurn ?? false;
  return (
    <div
      style={{
        padding: "8px 12px",
        background: "#16213e",
        borderRadius: 8,
        border: "1px solid #333",
      }}
    >
      <div>{name}</div>
      <div style={{ fontSize: 12, color: "#888" }}>
        HP: {card.currentHealth ?? "?"}
        {attacked && " • Attacked"}
      </div>
      {canAttack && !attacked && targetIds.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 11 }}>
          Attack:{" "}
          {targetIds.map((tid) => (
            <button
              key={tid}
              type="button"
              onClick={() => onAttack(card.instanceId, tid)}
              style={{ marginRight: 4 }}
            >
              {tid}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchmakingScreen({
  connected,
  wsUrl,
  matchmakingStatus,
  lobbyCode,
  matchmakingMessage,
  error,
  sendMatchmaking,
}: {
  connected: boolean;
  wsUrl: string;
  matchmakingStatus: string;
  lobbyCode: string | null;
  matchmakingMessage: string | null;
  error: string | null;
  sendMatchmaking: (intent: import("./types").MatchmakingIntent) => void;
}) {
  const [codeInput, setCodeInput] = useState("");

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1>TCG – Matchmaking</h1>
      <p style={{ fontSize: 14, color: connected ? "#2ecc71" : "#e74c3c", marginBottom: 16 }}>
        {connected ? "● Connected to " + wsUrl : "● Disconnected"}
      </p>
      {error && <p style={{ color: "#e74c3c", marginBottom: 8 }}>{error}</p>}
      {matchmakingMessage && (
        <p style={{ color: "#aaa", marginBottom: 16 }}>{matchmakingMessage}</p>
      )}

      {matchmakingStatus === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            type="button"
            onClick={() => sendMatchmaking({ type: "join_queue" })}
            disabled={!connected}
            style={{ padding: "12px 24px", fontSize: 16 }}
          >
            Join queue (find random opponent)
          </button>
          <button
            type="button"
            onClick={() => sendMatchmaking({ type: "create_lobby" })}
            disabled={!connected}
            style={{ padding: "12px 24px", fontSize: 16 }}
          >
            Create lobby (play with friend)
          </button>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input
              type="text"
              placeholder="Lobby code (e.g. ABC123)"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase().slice(0, 6))}
              style={{ padding: 8, width: 160, fontSize: 14 }}
              maxLength={6}
            />
            <button
              type="button"
              onClick={() => sendMatchmaking({ type: "join_lobby", code: codeInput.trim() })}
              disabled={!connected || codeInput.trim().length !== 6}
              style={{ padding: "8px 16px" }}
            >
              Join lobby
            </button>
          </div>
        </div>
      )}

      {matchmakingStatus === "queued" && (
        <div>
          <p>Searching for an opponent…</p>
          <button
            type="button"
            onClick={() => sendMatchmaking({ type: "leave_queue" })}
            disabled={!connected}
            style={{ marginTop: 12, padding: "8px 16px" }}
          >
            Leave queue
          </button>
        </div>
      )}

      {(matchmakingStatus === "lobby_host" || matchmakingStatus === "lobby_guest") && lobbyCode && (
        <div>
          <p><strong>Lobby code: {lobbyCode}</strong></p>
          <p style={{ fontSize: 14, color: "#888" }}>
            {matchmakingStatus === "lobby_host"
              ? "Share this code with your friend. Game starts when they join."
              : "Waiting for host. Game will start shortly."}
          </p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const {
    state,
    playerIndex,
    error,
    sendGame,
    sendMatchmaking,
    reconnect,
    connected,
    status,
    closeReason,
    matchmakingStatus,
    lobbyCode,
    matchmakingMessage,
    wsUrl,
  } = useGame();

  const myIndex = playerIndex ?? 0;
  const myPlayer = state?.players[myIndex];
  const oppIndex = 1 - myIndex;
  const oppPlayer = state?.players[oppIndex];
  const isMyTurn = state?.currentTurn === myIndex && state?.winner === null;

  const handlePlayCreature = (cardInstanceId: string) => {
    sendGame({ type: "play_creature", cardInstanceId });
  };
  const handlePlaySpell = (cardInstanceId: string, targetId: string) => {
    sendGame({ type: "play_spell", cardInstanceId, targetId });
  };
  const handleAttack = (attackerInstanceId: string, targetId: string) => {
    sendGame({ type: "attack", attackerInstanceId, targetId });
  };
  const handleEndTurn = () => {
    sendGame({ type: "end_turn" });
  };

  const boardIds = {
    mine: myPlayer?.board.map((c) => c.instanceId) ?? [],
    theirs: oppPlayer?.board.map((c) => c.instanceId) ?? [],
  };

  if (status === "closed" || status === "error") {
    return (
      <div style={{ padding: 24, maxWidth: 500 }}>
        <p style={{ color: "#e74c3c" }}>Connection failed</p>
        <p>{closeReason || error || "Unknown error."}</p>
        <p style={{ fontSize: 12, color: "#888", marginTop: 16 }}>
          Server: <code>{wsUrl}</code>
          <br />
          Make sure the server is running: <code>cd server; npm run build; npm start</code>
          <br />
          If you host the server elsewhere, set <code>VITE_TCG_SERVER=wss://your-server</code> and rebuild.
        </p>
        <button
          type="button"
          onClick={reconnect}
          style={{ marginTop: 16, padding: "12px 24px", fontSize: 16 }}
        >
          Reconnect
        </button>
      </div>
    );
  }

  if (status === "connecting" || !connected) {
    return (
      <div style={{ padding: 24 }}>
        <p>Connecting to {wsUrl}…</p>
        <p style={{ fontSize: 12, color: "#888" }}>
          Start the server with: <code>cd server; npm run build; npm start</code>
        </p>
      </div>
    );
  }

  if (!state || playerIndex === null) {
    return (
      <MatchmakingScreen
        connected={connected}
        wsUrl={wsUrl}
        matchmakingStatus={matchmakingStatus}
        lobbyCode={lobbyCode}
        matchmakingMessage={matchmakingMessage}
        error={error}
        sendMatchmaking={sendMatchmaking}
      />
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1>TCG</h1>
      {error && (
        <p style={{ color: "#e74c3c", marginBottom: 8 }}>{error}</p>
      )}
      <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
        <HeroBlock label="Opponent" health={oppPlayer?.heroHealth ?? 0} />
        <HeroBlock label="You" health={myPlayer?.heroHealth ?? 0} />
        <div style={{ padding: 8 }}>
          <div style={{ fontSize: 12, color: "#aaa" }}>Mana</div>
          <div style={{ fontSize: 24 }}>{state.manaRemaining} / 10</div>
        </div>
        <div style={{ padding: 8 }}>
          <div style={{ fontSize: 12, color: "#aaa" }}>Turn</div>
          <div style={{ fontSize: 24 }}>
            {state.currentTurn === myIndex ? "You" : "Opponent"}
          </div>
        </div>
        {state.winner !== null && (
          <div style={{ padding: 8, color: "#2ecc71", fontSize: 20 }}>
            {state.winner === myIndex ? "You win!" : "You lose!"}
          </div>
        )}
      </div>

      <Board player={oppPlayer!} label="Opponent board" />

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>Your board</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 60 }}>
          {myPlayer?.board.length === 0 && (
            <span style={{ color: "#666" }}>No creatures</span>
          )}
          {myPlayer?.board.map((c) => (
            <BoardCreature
              key={c.instanceId}
              card={c}
              canAttack={isMyTurn && state.winner === null}
              onAttack={handleAttack}
              targetIds={[`hero-${oppIndex}`, ...boardIds.theirs]}
            />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>
          Your hand (deck: {myPlayer?.deck.length ?? 0})
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {myPlayer?.hand.map((c) => (
            <HandCard
              key={c.instanceId}
              card={c}
              canPlay={isMyTurn && state.winner === null}
              onPlayCreature={handlePlayCreature}
              onPlaySpell={handlePlaySpell}
              targetIds={["hero-0", "hero-1", ...boardIds.mine, ...boardIds.theirs]}
            />
          ))}
        </div>
      </div>

      {isMyTurn && (
        <button
          type="button"
          onClick={handleEndTurn}
          style={{ marginTop: 16, padding: "8px 16px" }}
        >
          End turn
        </button>
      )}

      {state.lastAction && (
        <p style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
          Last: {state.lastAction}
        </p>
      )}
    </div>
  );
}
