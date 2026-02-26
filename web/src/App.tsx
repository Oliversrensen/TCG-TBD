import { useState, useCallback, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useGame } from "./useGame";
import { getCardTemplate } from "./cardData";
import { cardName } from "./cardNames";
import { authClient, getNeonAuthToken } from "./auth";
import type { CardInstance } from "./types";

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
  const clickable = Boolean(isTarget && onTarget && targetId);
  const hintColor = targetKind === "attack" ? "#f59e0b" : "#5b9bd5";
  return (
    <motion.div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onTarget!(targetId!) : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && onTarget?.(targetId!) : undefined}
      className={`tcg-hero ${clickable ? "tcg-hero-targetable" : ""}`}
      whileHover={clickable ? { scale: 1.02 } : {}}
    >
      <div className="tcg-hero-label">{label}</div>
      <div className="tcg-hero-health">❤ {health}</div>
      {isTarget && <div style={{ fontSize: 10, color: hintColor, marginTop: 4 }}>Click to target</div>}
    </motion.div>
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
  index,
  totalCards,
  dragProps,
}: {
  card: CardInstance;
  template: ReturnType<typeof getCardTemplate>;
  canPlay: boolean;
  manaRemaining: number;
  onPlayCreature: (id: string) => void;
  onPlaySpellNoTarget: (cardInstanceId: string) => void;
  onStartSpellTarget: (cardInstanceId: string) => void;
  isSpellTargetMode: boolean;
  index?: number;
  totalCards?: number;
  dragProps?: { attributes: object; listeners: object | undefined; setNodeRef: (el: HTMLElement | null) => void; isDragging: boolean };
}) {
  if (!template) return null;
  const canAfford = canPlay && manaRemaining >= template.cost;
  const isCreature = template.type === "creature";
  const isSpell = template.type === "spell";
  const spellNeedsTarget = isSpell && spellRequiresTarget(template);
  const isThisSpellSelected = isSpellTargetMode;
  const playableNoTarget = canAfford && (isCreature || (isSpell && !spellNeedsTarget));
  const fanOffset = index != null && totalCards != null && totalCards > 1
    ? ((index / (totalCards - 1 || 1)) - 0.5) * 12
    : 0;

  return (
    <motion.div
      ref={dragProps?.setNodeRef}
      {...(dragProps?.attributes)}
      {...(dragProps?.listeners)}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`tcg-card ${template.type === "creature" ? "tcg-card-creature" : "tcg-card-spell"} ${playableNoTarget ? "tcg-card-playable" : ""}`}
      style={{
        opacity: canAfford ? (dragProps?.isDragging ? 0.9 : 1) : 0.7,
        transform: `rotate(${fanOffset}deg)`,
        zIndex: dragProps?.isDragging ? 1000 : undefined,
        borderColor: isThisSpellSelected ? "#5b9bd5" : undefined,
      }}
    >
      <span className="tcg-card-cost">{template.cost}</span>
      <div className="tcg-card-name">{template.name}</div>
      <div className="tcg-card-stats">
        {isCreature && `${template.attack}/${template.health}`}
        {isSpell && spellDescription(template)}
      </div>
      {template.keywords?.length ? <div className="tcg-card-keywords">{template.keywords.join(" ")}</div> : null}
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {canAfford && isCreature && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onPlayCreature(card.instanceId); }}>Play</button>
        )}
        {canAfford && isSpell && spellNeedsTarget && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onStartSpellTarget(card.instanceId); }}>
            {isThisSpellSelected ? "Click a target above" : "Choose target"}
          </button>
        )}
        {canAfford && isSpell && !spellNeedsTarget && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onPlaySpellNoTarget(card.instanceId); }}>Play</button>
        )}
      </div>
    </motion.div>
  );
}

const MAX_BOARD_SLOTS = 7;

function slotId(index: number) {
  return `board-slot-${index}`;
}

function parseSlotId(id: string): number | null {
  const m = String(id).match(/^board-slot-(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function DraggableHandCard(props: Parameters<typeof HandCard>[0] & { canDrag: boolean }) {
  const { canDrag, card, ...rest } = props;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.instanceId,
    data: { card, instanceId: card.instanceId },
    disabled: !canDrag,
  });
  return (
    <HandCard
      {...rest}
      card={card}
      dragProps={canDrag ? { attributes, listeners, setNodeRef, isDragging } : undefined}
      index={props.index}
      totalCards={props.totalCards}
    />
  );
}

function DroppableSlot({
  slotIndex,
  children,
}: {
  slotIndex: number;
  children: ReactNode;
  isEmpty?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(slotIndex) });
  return (
    <div ref={setNodeRef} className={`tcg-drop-zone tcg-drop-slot ${isOver ? "tcg-drop-active" : ""}`}>
      {children}
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
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`tcg-card tcg-card-creature ${isSelectedAttacker ? "tcg-card-selected" : ""}`}
      role={clickableAsSpellTarget ? "button" : undefined}
      tabIndex={clickableAsSpellTarget ? 0 : undefined}
      onClick={clickableAsSpellTarget ? () => onSpellTarget?.(card.instanceId) : undefined}
      onKeyDown={clickableAsSpellTarget ? (e) => e.key === "Enter" && onSpellTarget?.(card.instanceId) : undefined}
      style={{
        borderColor: isSelectedAttacker ? "var(--accent-success)" : isSpellTarget ? "#5b9bd5" : undefined,
        cursor: clickableAsSpellTarget ? "pointer" : "default",
      }}
    >
      <span className="tcg-card-cost">{template.cost}</span>
      <div className="tcg-card-name">{template.name}</div>
      {template.keywords?.length ? <div className="tcg-card-keywords">{template.keywords.join(" ")}</div> : null}
      <div className="tcg-card-stats">
        <span>⚔ {atkDisplay}</span>
        <span>❤ {maxHp > (template.health ?? 0) ? `${health}/${maxHp}` : health}</span>
      </div>
      {attacked && <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Attacked</div>}
      {isSpellTarget && <div style={{ fontSize: 9, color: "#5b9bd5" }}>Click to target</div>}
      {canAttack && !attacked && !isSpellTarget && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onStartAttack(card.instanceId); }}>
          {isSelectedAttacker ? "Click enemy above" : "Attack"}
        </button>
      )}
    </motion.div>
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
  const borderColor = isSpellTarget ? "#4fc3f7" : isAttackTarget ? "#ff9800" : "rgba(212,175,55,0.4)";
  const hint = isSpellTarget ? "Click to target" : isAttackTarget ? "Click to attack" : null;
  return (
    <motion.div
      layout
      className="tcg-card tcg-card-creature"
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onTarget?.(card.instanceId) : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && onTarget?.(card.instanceId) : undefined}
      style={{
        borderColor: clickable ? borderColor : undefined,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <span className="tcg-card-cost">{template.cost}</span>
      <div className="tcg-card-name">{template.name}</div>
      {template.keywords?.length ? <div className="tcg-card-keywords">{template.keywords.join(" ")}</div> : null}
      <div className="tcg-card-stats">
        <span>⚔ {atkDisplay}</span>
        <span>❤ {maxHp > (template.health ?? 0) ? `${health}/${maxHp}` : health}</span>
      </div>
      {hint && <div style={{ fontSize: 9, color: borderColor }}>{hint}</div>}
    </motion.div>
  );
}

function MatchmakingScreen({
  connected,
  wsUrl: _wsUrl,
  matchmakingStatus,
  lobbyCode,
  matchmakingMessage: _matchmakingMessage,
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
    <div className="tcg-screen">
      <h1>TCG — Matchmaking</h1>
      {error && <p style={{ color: "var(--accent-danger)", marginBottom: 12 }}>{error}</p>}

      <div className="tcg-panel">
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

  const handlePlayCreature = (cardInstanceId: string, boardIndex?: number) => {
    sendGame({ type: "play_creature", cardInstanceId, boardIndex });
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const [activeCard, setActiveCard] = useState<{ card: CardInstance; template: ReturnType<typeof getCardTemplate> } | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const instanceId = event.active.id as string;
    const card = state?.players[playerIndex ?? 0]?.hand.find((c) => c.instanceId === instanceId);
    if (card) {
      const template = getCardTemplate(card.cardId);
      if (template) setActiveCard({ card, template });
    }
  }, [state?.players, playerIndex]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCard(null);
      if (!over || typeof over.id !== "string") return;
      const slotIndex = parseSlotId(over.id);
      const instanceId = active.id as string;
      const card = state?.players[playerIndex ?? 0]?.hand.find((c) => c.instanceId === instanceId);
      if (!card) return;
      const template = getCardTemplate(card.cardId);
      if (!template) return;
      const canAfford = state && state.winner === null && (state.currentTurn === playerIndex) && state.manaRemaining >= template.cost;
      if (!canAfford) return;
      if (template.type === "creature" && slotIndex != null && slotIndex >= 0 && slotIndex < MAX_BOARD_SLOTS) {
        sendGame({ type: "play_creature", cardInstanceId: instanceId, boardIndex: slotIndex });
      } else if (template.type === "spell" && !spellRequiresTarget(template)) {
        sendGame({ type: "play_spell", cardInstanceId: instanceId });
      }
    },
    [state, playerIndex, sendGame]
  );

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
      <div className="tcg-screen">
        <h1>TCG</h1>
        <p style={{ color: "var(--accent-danger)", marginBottom: 16 }}>Connection failed</p>
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
      <div className="tcg-screen">
        <h1>TCG</h1>
        <p style={{ color: "var(--text-secondary)" }}>Connecting…</p>
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
    <div className="tcg-app">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveCard(null)}>
    <div className="tcg-board">
    <div className="tcg-board-inner">
      <div className="tcg-hud">
        <h1 className="tcg-title">TCG</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="tcg-hud-pill">
            <span className="tcg-hud-label">Mana</span>
            <span className="tcg-hud-value tcg-mana">{state.manaRemaining} / 10</span>
          </div>
          <div className="tcg-hud-pill">
            <span className="tcg-hud-label">Turn</span>
            <span className="tcg-hud-value">{state.currentTurn === myIndex ? "You" : (opponentUsername ?? "Opponent")}</span>
          </div>
          {state.winner !== null && (
            <motion.div className="tcg-winner" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              {state.winner === myIndex ? "You win!" : "You lose!"}
            </motion.div>
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
      {error && <p style={{ color: "var(--accent-danger)", marginBottom: 12 }}>{error}</p>}

      {/* Opponent side (top) */}
      <div className="tcg-section">
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
        <div className="tcg-section-title">{opponentUsername ?? "Opponent"}&apos;s minions</div>
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
      <div className="tcg-section">
        <div className="tcg-section-title">Your minions — drag to a slot</div>
        <div className="tcg-board-slots">
          {Array.from({ length: MAX_BOARD_SLOTS }, (_, i) => (
            <DroppableSlot key={i} slotIndex={i}>
              {myPlayer?.board[i] ? (
                <MyBoardCreature
                  card={myPlayer.board[i]}
                  template={getCardTemplate(myPlayer.board[i].cardId)}
                  canAttack={isMyTurn && state.winner === null && attackTargets.length > 0}
                  attacked={myPlayer.board[i].attackedThisTurn ?? false}
                  onStartAttack={setAttackModeAttacker}
                  isSelectedAttacker={attackModeAttacker === myPlayer.board[i].instanceId}
                  isSpellTarget={!!spellTargetCardInstanceId && isSpellTargetId(myPlayer.board[i].instanceId)}
                  onSpellTarget={spellTargetCardInstanceId ? handleTargetClick : undefined}
                />
              ) : null}
            </DroppableSlot>
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

        <div className="tcg-section-title">
          Your hand (deck: {myPlayer?.deck.length ?? 0}) — drag to play or click Play
        </div>
        <div className="tcg-hand">
          {myPlayer?.hand.map((c, i) => (
            <DraggableHandCard
              key={c.instanceId}
              card={c}
              template={getCardTemplate(c.cardId)}
              canPlay={isMyTurn && state.winner === null}
              manaRemaining={state.manaRemaining}
              onPlayCreature={handlePlayCreature}
              onPlaySpellNoTarget={handlePlaySpellNoTarget}
              onStartSpellTarget={setSpellTargetCardInstanceId}
              isSpellTargetMode={spellTargetCardInstanceId === c.instanceId}
              canDrag={isMyTurn && state.winner === null && state.manaRemaining >= (getCardTemplate(c.cardId)?.cost ?? 999) && (getCardTemplate(c.cardId)?.type === "creature" || !spellRequiresTarget(getCardTemplate(c.cardId)!))}
              index={i}
              totalCards={myPlayer.hand.length}
            />
          ))}
        </div>

        {isMyTurn && (
          <motion.button type="button" onClick={handleEndTurn} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ marginTop: 16, padding: "12px 28px", fontSize: 15, fontWeight: 600 }}>
            End turn
          </motion.button>
        )}
      </div>

      {state.lastAction && (
        <p className="tcg-last-action">Last: {state.lastAction}</p>
      )}
    </div>
    </div>
        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <HandCard
              card={activeCard.card}
              template={activeCard.template}
              canPlay
              manaRemaining={state?.manaRemaining ?? 0}
              onPlayCreature={() => {}}
              onPlaySpellNoTarget={() => {}}
              onStartSpellTarget={() => {}}
              isSpellTargetMode={false}
              index={0}
              totalCards={1}
            />
          ) : null}
        </DragOverlay>
    </DndContext>
    </div>
  );
}
