import { useState } from "react";
import { useGame } from "./useGame";
import { getCardTemplate } from "./cardData";
import { cardName } from "./cardNames";
import { authClient, getNeonAuthToken } from "./auth";
import type { CardInstance } from "./types";

const CARD_WIDTH = 90;
const CARD_HEIGHT = Math.round(CARD_WIDTH * (3.5 / 2.5));

export interface TargetOption {
  targetId: string;
  label: string;
}

function buildAttackTargets(
  oppIndex: 0 | 1,
  theirBoardIds: string[],
  getCreatureName: (instanceId: string) => string,
  opponentLabel: string = "Opponent"
): TargetOption[] {
  const opts: TargetOption[] = [{ targetId: `hero-${oppIndex}`, label: `${opponentLabel}'s hero` }];
  theirBoardIds.forEach((id) => opts.push({ targetId: id, label: getCreatureName(id) }));
  return opts;
}

const cardShape = {
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
  borderRadius: 8,
  padding: 6,
  boxSizing: "border-box" as const,
  display: "flex",
  flexDirection: "column" as const,
  border: "1px solid #444",
};

function HeroBlock({
  label,
  health,
  targetId,
  isTarget,
  targetKind,
  onTarget,
}: {
  label: string;
  health: number;
  targetId?: string;
  isTarget?: boolean;
  targetKind?: "spell" | "attack";
  onTarget?: (id: string) => void;
}) {
  const clickable = isTarget && onTarget && targetId;
  const borderColor = targetKind === "spell" ? "#4fc3f7" : targetKind === "attack" ? "#ff9800" : "#333";
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onTarget!(targetId!) : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && onTarget?.(targetId!) : undefined}
      style={{
        padding: "12px 20px",
        background: isTarget ? "#2a3f5f" : "#1a1a2e",
        borderRadius: 12,
        border: isTarget ? `2px solid ${borderColor}` : "1px solid #333",
        cursor: clickable ? "pointer" : "default",
        minWidth: 120,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, color: "#aaa" }}>{label}</div>
      <div style={{ fontSize: 22 }}>❤️ {health}</div>
      {isTarget && <div style={{ fontSize: 10, color: borderColor, marginTop: 4 }}>Click to target</div>}
    </div>
  );
}

function spellRequiresTarget(template: { spellEffect?: string; requiresTarget?: boolean; spellPower?: number }): boolean {
  if (template.requiresTarget === false) return false;
  if (template.spellEffect === "draw" || template.spellEffect === "summon_random" || template.spellEffect === "create_persistent") return false;
  return template.spellPower != null;
}

function effectiveAttack(template: { attack?: number }, card: CardInstance): number {
  return (template.attack ?? 0) + (card.attackBuff ?? 0);
}
function effectiveMaxHealth(template: { health?: number }, card: CardInstance): number {
  return (template.health ?? 0) + (card.healthBuff ?? 0);
}

function spellDescription(template: { spellEffect?: string; spellPower?: number; spellDraw?: number; spellPersistent?: { duration: number; effect?: { type?: string; damage?: number } } }): string {
  if (template.spellEffect === "draw") return `Draw ${template.spellDraw ?? 2}`;
  if (template.spellEffect === "summon_random") return "Summon random minion";
  if (template.spellEffect === "create_persistent" && template.spellPersistent) {
    const p = template.spellPersistent;
    const dmg = p.effect?.damage ?? 0;
    const desc = p.effect?.type === "deal_damage_all_enemy_minions" ? `Deal ${dmg} to all enemy minions` : "Effect";
    return `${desc} (${p.duration} turns)`;
  }
  if (template.spellPower != null) return `Deal ${template.spellPower} damage`;
  return "Spell";
}

function HandCard({
  card,
  template,
  canPlay,
  manaRemaining,
  onPlayCreature,
  onPlaySpellNoTarget,
  onStartSpellTarget,
  isSpellTargetMode,
}: {
  card: CardInstance;
  template: ReturnType<typeof getCardTemplate>;
  canPlay: boolean;
  manaRemaining: number;
  onPlayCreature: (id: string) => void;
  onPlaySpellNoTarget: (cardInstanceId: string) => void;
  onStartSpellTarget: (cardInstanceId: string) => void;
  isSpellTargetMode: boolean;
}) {
  if (!template) return null;
  const canAfford = canPlay && manaRemaining >= template.cost;
  const isCreature = template.type === "creature";
  const isSpell = template.type === "spell";
  const spellNeedsTarget = isSpell && spellRequiresTarget(template);
  const isThisSpellSelected = isSpellTargetMode;

  return (
    <div
      style={{
        ...cardShape,
        background: canAfford ? "linear-gradient(145deg, #1e3a5f 0%, #16213e 100%)" : "#0d1117",
        opacity: canAfford ? 1 : 0.85,
        border: isThisSpellSelected ? "2px solid #4fc3f7" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#0f3460",
            color: "#fff",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
          }}
        >
          {template.cost}
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, textAlign: "center", lineHeight: 1.2 }}>
        {template.name}
      </div>
      <div style={{ fontSize: 10, color: "#aaa", textAlign: "center" }}>
        {isCreature && `${template.attack}/${template.health}`}
        {isSpell && spellDescription(template)}
      </div>
      <div style={{ marginTop: 4 }}>
        {canAfford && isCreature && (
          <button type="button" onClick={() => onPlayCreature(card.instanceId)} style={{ width: "100%", padding: "4px 0", fontSize: 10, cursor: "pointer" }}>
            Play
          </button>
        )}
        {canAfford && isSpell && spellNeedsTarget && (
          <button type="button" onClick={() => onStartSpellTarget(card.instanceId)} style={{ width: "100%", padding: "4px 0", fontSize: 10, cursor: "pointer" }}>
            {isThisSpellSelected ? "Click a target above" : "Choose target"}
          </button>
        )}
        {canAfford && isSpell && !spellNeedsTarget && (
          <button type="button" onClick={() => onPlaySpellNoTarget(card.instanceId)} style={{ width: "100%", padding: "4px 0", fontSize: 10, cursor: "pointer" }}>
            Play
          </button>
        )}
      </div>
    </div>
  );
}

function MyBoardCreature({
  card,
  template,
  canAttack,
  attacked,
  onStartAttack,
  isSelectedAttacker,
  isSpellTarget,
  onSpellTarget,
}: {
  card: CardInstance;
  template: ReturnType<typeof getCardTemplate>;
  canAttack: boolean;
  attacked: boolean;
  onStartAttack: (id: string) => void;
  isSelectedAttacker: boolean;
  isSpellTarget?: boolean;
  onSpellTarget?: (id: string) => void;
}) {
  if (!template) return null;
  const maxHp = effectiveMaxHealth(template, card);
  const health = card.currentHealth ?? template.health ?? 0;
  const atk = effectiveAttack(template, card);
  const atkDisplay = String(atk);
  const clickableAsSpellTarget = isSpellTarget && onSpellTarget;
  return (
    <div
      role={clickableAsSpellTarget ? "button" : undefined}
      tabIndex={clickableAsSpellTarget ? 0 : undefined}
      onClick={clickableAsSpellTarget ? () => onSpellTarget?.(card.instanceId) : undefined}
      onKeyDown={clickableAsSpellTarget ? (e) => e.key === "Enter" && onSpellTarget?.(card.instanceId) : undefined}
      style={{
        ...cardShape,
        background: isSelectedAttacker ? "linear-gradient(145deg, #2d4a3e 0%, #1e3a2f 100%)" : "linear-gradient(145deg, #1e3a5f 0%, #16213e 100%)",
        border: isSelectedAttacker ? "2px solid #4caf50" : isSpellTarget ? "2px solid #4fc3f7" : "1px solid #444",
        cursor: clickableAsSpellTarget ? "pointer" : "default",
      }}
    >
      <div style={{ fontSize: 10, color: "#888" }}>{template.cost}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, textAlign: "center" }}>
        {template.name}
      </div>
      {template.keywords?.length ? <div style={{ fontSize: 9, color: "#b8a" }}>{template.keywords.join(" ")}</div> : null}
      <div style={{ display: "flex", justifyContent: "space-around", fontSize: 11 }}>
        <span>⚔️ {atkDisplay}</span>
        <span>❤️ {maxHp > (template.health ?? 0) ? `${health}/${maxHp}` : health}</span>
      </div>
      {attacked && <div style={{ fontSize: 9, color: "#888" }}>Attacked</div>}
      {isSpellTarget && <div style={{ fontSize: 9, color: "#4fc3f7" }}>Click to target</div>}
      {canAttack && !attacked && !isSpellTarget && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onStartAttack(card.instanceId); }} style={{ fontSize: 9, marginTop: 2, cursor: "pointer" }}>
          {isSelectedAttacker ? "Click enemy above" : "Attack"}
        </button>
      )}
    </div>
  );
}

function OpponentCreatureAsTarget({
  card,
  template,
  isAttackTarget,
  isSpellTarget,
  onTarget,
}: {
  card: CardInstance;
  template: ReturnType<typeof getCardTemplate>;
  isAttackTarget: boolean;
  isSpellTarget: boolean;
  onTarget?: (id: string) => void;
}) {
  if (!template) return null;
  const maxHp = effectiveMaxHealth(template, card);
  const health = card.currentHealth ?? template.health ?? 0;
  const atk = effectiveAttack(template, card);
  const atkDisplay = String(atk);
  const clickable = (isAttackTarget || isSpellTarget) && onTarget;
  const borderColor = isSpellTarget ? "#4fc3f7" : isAttackTarget ? "#ff9800" : "#444";
  const hint = isSpellTarget ? "Click to target" : isAttackTarget ? "Click to attack" : null;
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onTarget?.(card.instanceId) : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && onTarget?.(card.instanceId) : undefined}
      style={{
        ...cardShape,
        background: "linear-gradient(145deg, #1e3a5f 0%, #16213e 100%)",
        border: clickable ? `2px solid ${borderColor}` : "1px solid #444",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <div style={{ fontSize: 10, color: "#888" }}>{template.cost}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, textAlign: "center" }}>
        {template.name}
      </div>
      {template.keywords?.length ? <div style={{ fontSize: 9, color: "#b8a" }}>{template.keywords.join(" ")}</div> : null}
      <div style={{ display: "flex", justifyContent: "space-around", fontSize: 11 }}>
        <span>⚔️ {atkDisplay}</span>
        <span>❤️ {maxHp > (template.health ?? 0) ? `${health}/${maxHp}` : health}</span>
      </div>
      {hint && <div style={{ fontSize: 9, color: borderColor }}>{hint}</div>}
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
  authUser,
  authError,
  onLogin,
  onRegister,
  onLogout,
}: {
  connected: boolean;
  wsUrl: string;
  matchmakingStatus: string;
  lobbyCode: string | null;
  matchmakingMessage: string | null;
  error: string | null;
  sendMatchmaking: (intent: import("./types").MatchmakingIntent) => void;
  authUser: { userId: string; username: string } | null;
  authError: string | null;
  onLogin: (email: string, password: string) => Promise<void> | void;
  onRegister: (email: string, password: string, name: string) => Promise<void> | void;
  onLogout: () => void;
}) {
  const [codeInput, setCodeInput] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState<"login" | "register" | null>(null);
  const [authLocalError, setAuthLocalError] = useState<string | null>(null);

  const handleAuth = async (mode: "login" | "register") => {
    setAuthLocalError(null);
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || !password) {
      setAuthLocalError("Email and password are required.");
      return;
    }
    if (mode === "register") {
      const name = authName.trim() || email.split("@")[0] || "User";
      try {
        setAuthSubmitting(mode);
        await onRegister(email, password, name);
        setAuthPassword("");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Sign up failed";
        setAuthLocalError(msg);
      } finally {
        setAuthSubmitting(null);
      }
    } else {
      try {
        setAuthSubmitting(mode);
        await onLogin(email, password);
        setAuthPassword("");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Sign in failed";
        setAuthLocalError(msg);
      } finally {
        setAuthSubmitting(null);
      }
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1>TCG – Matchmaking</h1>
      {error && <p style={{ color: "#e74c3c", marginBottom: 8 }}>{error}</p>}

      <div style={{ marginBottom: 24, padding: 12, borderRadius: 8, background: "#111827" }}>
        {authUser ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#a5b4fc" }}>Logged in as <strong>{authUser.username}</strong></span>
            <button type="button" onClick={onLogout} style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>
              Log out
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#e5e7eb" }}>
              {authMode === "login" ? "Sign in to play:" : "Create an account:"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                type="email"
                placeholder="Email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                style={{ padding: 6, minWidth: 200, fontSize: 13 }}
              />
              {authMode === "signup" && (
                <input
                  type="text"
                  placeholder="Display name"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  style={{ padding: 6, minWidth: 200, fontSize: 13 }}
                />
              )}
              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                style={{ padding: 6, minWidth: 200, fontSize: 13 }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => void handleAuth(authMode === "login" ? "login" : "register")}
                  disabled={authSubmitting !== null || !connected}
                  style={{ padding: "6px 12px", fontSize: 13 }}
                >
                  {authSubmitting === "login" ? "Signing in…" : authSubmitting === "register" ? "Signing up…" : authMode === "login" ? "Sign in" : "Sign up"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode((m) => (m === "login" ? "signup" : "login"));
                    setAuthLocalError(null);
                  }}
                  style={{ padding: "6px 12px", fontSize: 12, background: "transparent", border: "none", color: "#93c5fd", cursor: "pointer", textDecoration: "underline" }}
                >
                  {authMode === "login" ? "Create an account" : "Already have an account? Sign in"}
                </button>
              </div>
            </div>
            {(authLocalError || authError) && (
              <div style={{ fontSize: 12, color: "#fca5a5" }}>{authLocalError || authError}</div>
            )}
          </div>
        )}
      </div>
      

      {authUser && matchmakingStatus === "idle" && (
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

      {!authUser && matchmakingStatus === "idle" && (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Sign in above to join the queue or create or join a lobby.</p>
      )}

      {authUser && matchmakingStatus === "queued" && (
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

      {authUser && (matchmakingStatus === "lobby_host" || matchmakingStatus === "lobby_guest") && lobbyCode && (
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
    authUser,
    authError,
    opponentUsername,
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
  const handlePlaySpellNoTarget = (cardInstanceId: string) => {
    sendGame({ type: "play_spell", cardInstanceId });
  };
  const handleAttack = (attackerInstanceId: string, targetId: string) => {
    sendGame({ type: "attack", attackerInstanceId, targetId });
  };
  const handleEndTurn = () => {
    sendGame({ type: "end_turn" });
  };

  const storeTokenAndAuthenticate = async (token: string, username: string) => {
    window.localStorage.setItem("tcg_token", token);
    window.localStorage.setItem("tcg_username", username);
    if (connected) {
      sendMatchmaking({ type: "authenticate", token });
    }
  };

  const handleLogin = async (email: string, password: string) => {
    if (!authClient) throw new Error("Neon Auth is not configured. Set VITE_NEON_AUTH_URL.");
    const result = await authClient.signIn.email({ email, password });
    if (result.error) throw new Error(result.error.message || "Sign in failed");
    const user = result.data?.user;
    const username = user?.name ?? user?.email ?? email;
    const token = await getNeonAuthToken();
    if (!token) throw new Error("Could not get session token");
    await storeTokenAndAuthenticate(token, username);
  };

  const handleRegister = async (email: string, password: string, name: string) => {
    if (!authClient) throw new Error("Neon Auth is not configured. Set VITE_NEON_AUTH_URL.");
    const result = await authClient.signUp.email({ email, password, name: name || email.split("@")[0] || "User" });
    if (result.error) throw new Error(result.error.message || "Sign up failed");
    const user = result.data?.user;
    const username = user?.name ?? user?.email ?? email;
    const token = await getNeonAuthToken();
    if (!token) throw new Error("Could not get session token");
    await storeTokenAndAuthenticate(token, username);
  };

  const handleLogout = async () => {
    if (authClient) await authClient.signOut();
    window.localStorage.removeItem("tcg_token");
    window.localStorage.removeItem("tcg_username");
  };

  const [attackModeAttacker, setAttackModeAttacker] = useState<string | null>(null);
  const [spellTargetCardInstanceId, setSpellTargetCardInstanceId] = useState<string | null>(null);

  const boardIds = {
    mine: myPlayer?.board.map((c) => c.instanceId) ?? [],
    theirs: oppPlayer?.board.map((c) => c.instanceId) ?? [],
  };

  const getCreatureName = (instanceId: string): string => {
    const allCards = [...(myPlayer?.board ?? []), ...(myPlayer?.hand ?? []), ...(oppPlayer?.board ?? []), ...(oppPlayer?.hand ?? [])];
    const c = allCards.find((x) => x.instanceId === instanceId);
    return c ? cardName(c.cardId) : instanceId;
  };

  const spellTargetIds = new Set(["hero-0", "hero-1", ...boardIds.mine, ...boardIds.theirs]);
  const isSpellTargetId = (id: string) => spellTargetIds.has(id);
  const attackTargets = buildAttackTargets(oppIndex as 0 | 1, boardIds.theirs, getCreatureName, opponentUsername ?? "Opponent");
  const isAttackTargetId = (id: string) => attackTargets.some((t) => t.targetId === id);

  const handleTargetClick = (targetId: string) => {
    if (spellTargetCardInstanceId) {
      handlePlaySpell(spellTargetCardInstanceId, targetId);
      setSpellTargetCardInstanceId(null);
    } else if (attackModeAttacker) {
      handleAttackTarget(targetId);
    }
  };

  const heroIsSpellTarget = (targetId: string) => !!spellTargetCardInstanceId && (targetId === "hero-0" || targetId === "hero-1");
  const heroIsAttackTarget = (targetId: string) => !!attackModeAttacker && targetId === `hero-${oppIndex}`;
  const heroIsTarget = (targetId: string) => heroIsSpellTarget(targetId) || heroIsAttackTarget(targetId);
  const heroTargetKind = (targetId: string): "spell" | "attack" | undefined =>
    heroIsSpellTarget(targetId) ? "spell" : heroIsAttackTarget(targetId) ? "attack" : undefined;

  if (status === "closed" || status === "error") {
    return (
      <div style={{ padding: 24, maxWidth: 500 }}>
        <p style={{ color: "#e74c3c" }}>Connection failed</p>
        <p>{closeReason || error || "Unknown error."}</p>
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
        authUser={authUser}
        authError={authError}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onLogout={handleLogout}
      />
    );
  }

  const handleAttackTarget = (targetId: string) => {
    if (attackModeAttacker) {
      handleAttack(attackModeAttacker, targetId);
      setAttackModeAttacker(null);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0 }}>TCG</h1>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ padding: "8px 12px", background: "#1a1a2e", borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: "#aaa" }}>Mana </span>
            <span style={{ fontSize: 20, fontWeight: "bold" }}>{state.manaRemaining} / 10</span>
          </div>
          <div style={{ padding: "8px 12px", background: "#1a1a2e", borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: "#aaa" }}>Turn </span>
            <span style={{ fontSize: 18 }}>{state.currentTurn === myIndex ? "You" : (opponentUsername ?? "Opponent")}</span>
          </div>
          {state.winner !== null && (
            <div style={{ padding: "8px 16px", background: "#2d4a3e", borderRadius: 8, color: "#4caf50", fontSize: 18 }}>
              {state.winner === myIndex ? "You win!" : "You lose!"}
            </div>
          )}
        </div>
      </div>
      {state.persistentEffects?.length ? (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
          {state.persistentEffects
            .filter((e) => e.ownerIndex === myIndex)
            .map((e) => (
              <span key={e.id} style={{ marginRight: 12 }}>
                {e.sourceCardName ?? "Effect"}: {e.turnsRemaining} turn{e.turnsRemaining !== 1 ? "s" : ""} left
              </span>
            ))}
        </div>
      ) : null}
      {error && <p style={{ color: "#e74c3c", marginBottom: 8 }}>{error}</p>}

      {/* Opponent side (top) */}
      <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        {spellTargetCardInstanceId && (
          <p style={{ fontSize: 12, color: "#4fc3f7", marginBottom: 8 }}>
            Choose a target for your spell (hero or minion).
            <button type="button" onClick={() => setSpellTargetCardInstanceId(null)} style={{ marginLeft: 12, padding: "2px 8px", cursor: "pointer" }}>Cancel</button>
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
          <HeroBlock
            label={`${opponentUsername ?? "Opponent"}'s hero`}
            health={oppPlayer?.heroHealth ?? 0}
            targetId={`hero-${oppIndex}`}
            isTarget={heroIsTarget(`hero-${oppIndex}`)}
            targetKind={heroTargetKind(`hero-${oppIndex}`)}
            onTarget={handleTargetClick}
          />
        </div>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>{opponentUsername ?? "Opponent"}&apos;s minions</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 50 }}>
          {oppPlayer?.board.length === 0 && <span style={{ color: "#666" }}>No minions</span>}
          {oppPlayer?.board.map((c) => (
            <OpponentCreatureAsTarget
              key={c.instanceId}
              card={c}
              template={getCardTemplate(c.cardId)}
              isAttackTarget={!!attackModeAttacker && isAttackTargetId(c.instanceId)}
              isSpellTarget={!!spellTargetCardInstanceId && isSpellTargetId(c.instanceId)}
              onTarget={handleTargetClick}
            />
          ))}
        </div>
      </div>

      {/* Your side (bottom): your board, your hero, your hand */}
      <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>Your minions</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 50, marginBottom: 16 }}>
          {myPlayer?.board.length === 0 && <span style={{ color: "#666" }}>No minions</span>}
          {myPlayer?.board.map((c) => (
            <MyBoardCreature
              key={c.instanceId}
              card={c}
              template={getCardTemplate(c.cardId)}
              canAttack={isMyTurn && state.winner === null && attackTargets.length > 0}
              attacked={c.attackedThisTurn ?? false}
              onStartAttack={setAttackModeAttacker}
              isSelectedAttacker={attackModeAttacker === c.instanceId}
              isSpellTarget={!!spellTargetCardInstanceId && isSpellTargetId(c.instanceId)}
              onSpellTarget={spellTargetCardInstanceId ? handleTargetClick : undefined}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <HeroBlock
            label="Your hero"
            health={myPlayer?.heroHealth ?? 0}
            targetId={`hero-${myIndex}`}
            isTarget={heroIsTarget(`hero-${myIndex}`)}
            targetKind={heroTargetKind(`hero-${myIndex}`)}
            onTarget={handleTargetClick}
          />
        </div>

        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
          Your hand (deck: {myPlayer?.deck.length ?? 0})
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {myPlayer?.hand.map((c) => (
            <HandCard
              key={c.instanceId}
              card={c}
              template={getCardTemplate(c.cardId)}
              canPlay={isMyTurn && state.winner === null}
              manaRemaining={state.manaRemaining}
              onPlayCreature={handlePlayCreature}
              onPlaySpellNoTarget={handlePlaySpellNoTarget}
              onStartSpellTarget={setSpellTargetCardInstanceId}
              isSpellTargetMode={spellTargetCardInstanceId === c.instanceId}
            />
          ))}
        </div>

        {isMyTurn && (
          <button
            type="button"
            onClick={handleEndTurn}
            style={{ marginTop: 16, padding: "10px 24px", fontSize: 16, cursor: "pointer" }}
          >
            End turn
          </button>
        )}
      </div>

      {state.lastAction && (
        <p style={{ marginTop: 12, fontSize: 12, color: "#888" }}>Last: {state.lastAction}</p>
      )}
    </div>
  );
}
