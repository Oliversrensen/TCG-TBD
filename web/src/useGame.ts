import { useState, useEffect, useCallback, useRef } from "react";
import type {
  GameState,
  ServerMessage,
  GameIntent,
  MatchmakingIntent,
} from "./types";

const WS_URL = import.meta.env.VITE_TCG_SERVER ?? "ws://localhost:8765";

export type ConnectionStatus = "connecting" | "connected" | "closed" | "error";

export type MatchmakingStatus = "idle" | "queued" | "lobby_host" | "lobby_guest";

export function useGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [playerIndex, setPlayerIndex] = useState<0 | 1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conn, setConn] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [closeReason, setCloseReason] = useState<string | null>(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState<MatchmakingStatus>("idle");
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);
  const [matchmakingMessage, setMatchmakingMessage] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<{ userId: string; username: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [opponentUsername, setOpponentUsername] = useState<string | null>(null);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const currentWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    currentWsRef.current = ws;
    setConn(ws);
    setStatus("connecting");
    setCloseReason(null);
    setError(null);
    setMatchmakingStatus("idle");
    setLobbyCode(null);
    setMatchmakingMessage(null);
    setState(null);
    setPlayerIndex(null);
    setAuthUser(null);
    setAuthError(null);

    ws.onopen = () => {
      if (currentWsRef.current !== ws) return;
      setStatus("connected");
      const token = typeof window !== "undefined" ? window.localStorage.getItem("tcg_token") : null;
      if (token) {
        ws.send(JSON.stringify({ type: "authenticate", token }));
      }
    };

    ws.onmessage = (e) => {
      if (currentWsRef.current !== ws) return;
      try {
        const msg: ServerMessage = JSON.parse(e.data as string);
        switch (msg.type) {
          case "connected":
            setError(null);
            setMatchmakingMessage(msg.message);
            break;
          case "joined_queue":
            setError(null);
            setMatchmakingStatus("queued");
            setMatchmakingMessage(msg.message);
            setLobbyCode(null);
            break;
          case "left_queue":
            setMatchmakingStatus("idle");
            setMatchmakingMessage(null);
            break;
          case "lobby_created":
            setError(null);
            setMatchmakingStatus("lobby_host");
            setLobbyCode(msg.code);
            setMatchmakingMessage(msg.message);
            break;
          case "lobby_joined":
            setLobbyCode(msg.code);
            setMatchmakingMessage(msg.message);
            setMatchmakingStatus((prev) => (prev === "lobby_host" ? "lobby_host" : "lobby_guest"));
            break;
          case "lobby_error":
            setMatchmakingStatus("idle");
            setLobbyCode(null);
            setMatchmakingMessage(msg.error);
            setError(msg.error);
            break;
          case "matchmaking_error":
            setMatchmakingMessage(msg.error);
            setError(msg.error);
            break;
          case "authenticated":
            setAuthUser({ userId: msg.userId, username: msg.username });
            setAuthError(null);
            break;
          case "auth_error":
            setAuthUser(null);
            setAuthError(msg.error);
            break;
          case "state":
            setState(msg.state);
            setPlayerIndex(msg.playerIndex);
            setError(msg.error ?? null);
            setOpponentUsername(msg.opponentUsername ?? null);
            setMatchmakingStatus("idle");
            setLobbyCode(null);
            setMatchmakingMessage(null);
            break;
          default:
            break;
        }
      } catch {
        setError("Invalid message");
      }
    };

    ws.onclose = (ev) => {
      if (currentWsRef.current !== ws) return;
      currentWsRef.current = null;
      setConn(null);
      setStatus("closed");
      setAuthUser(null);
      if (ev.code === 4000 && ev.reason === "Game full") {
        setCloseReason(
          "Game full (2 players already connected). Use Join queue or a lobby code instead."
        );
      } else if (!ev.wasClean && ev.code !== 1000) {
        setCloseReason(
          "Connection closed. Is the server running? Start it with: cd server; npm run build; npm start"
        );
      } else {
        setCloseReason(ev.reason || "Connection closed.");
      }
    };

    ws.onerror = () => {
      if (currentWsRef.current !== ws) return;
      setStatus("error");
      setError("Cannot reach server. Is it running at " + WS_URL + "?");
    };

    return () => {
      ws.close();
    };
  }, [reconnectTrigger]);

  const reconnect = useCallback(() => {
    setError(null);
    setCloseReason(null);
    setReconnectTrigger((n) => n + 1);
  }, []);

  const sendGame = useCallback(
    (intent: GameIntent) => {
      if (conn?.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify(intent));
      }
    },
    [conn]
  );

  const sendMatchmaking = useCallback(
    (intent: MatchmakingIntent) => {
      if (conn?.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify(intent));
      }
    },
    [conn]
  );

  return {
    state,
    playerIndex,
    error,
    authUser,
    authError,
    opponentUsername,
    sendGame,
    sendMatchmaking,
    reconnect,
    connected: conn?.readyState === WebSocket.OPEN,
    status,
    closeReason,
    matchmakingStatus,
    lobbyCode,
    matchmakingMessage,
    wsUrl: WS_URL,
  };
}
