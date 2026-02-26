// TCG Game Client - WebSocket connection, message parsing, and state management.

using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using TCG;
using TCG.Network;

namespace TCG.Network
{
    public enum ConnectionStatus { Connecting, Connected, Closed, Error }
    public enum MatchmakingStatus { Idle, Queued, LobbyHost, LobbyGuest }

    public class TCGGameClient
    {
        private readonly TCGWebSocket _ws;
        private readonly string _serverUrl;
        private string _storedToken;

        public GameState State { get; private set; }
        public int? PlayerIndex { get; private set; }
        public string Error { get; private set; }
        public ConnectionStatus Status { get; private set; } = ConnectionStatus.Connecting;
        public string CloseReason { get; private set; }
        public MatchmakingStatus MatchmakingStatus { get; private set; } = MatchmakingStatus.Idle;
        public string LobbyCode { get; private set; }
        public string MatchmakingMessage { get; private set; }
        public string AuthUserId { get; private set; }
        public string AuthUsername { get; private set; }
        public string AuthError { get; private set; }
        public string OpponentUsername { get; private set; }

        public bool Connected => Status == ConnectionStatus.Connected;
        public event Action OnStateChanged;

        private const string TokenPrefKey = "tcg_token";
        private const string UsernamePrefKey = "tcg_username";

        public TCGGameClient(string serverUrl)
        {
            _serverUrl = serverUrl ?? "ws://localhost:8765";
            _ws = new TCGWebSocket(_serverUrl);
            _storedToken = PlayerPrefs.GetString(TokenPrefKey, null);
            if (string.IsNullOrEmpty(_storedToken)) _storedToken = null;

            _ws.OnOpen += HandleOpen;
            _ws.OnMessage += HandleMessage;
            _ws.OnClose += HandleClose;
            _ws.OnError += HandleError;
        }

        public void Connect()
        {
            State = null;
            PlayerIndex = null;
            Error = null;
            CloseReason = null;
            MatchmakingStatus = MatchmakingStatus.Idle;
            LobbyCode = null;
            MatchmakingMessage = null;
            AuthUserId = null;
            AuthUsername = null;
            AuthError = null;
            Status = ConnectionStatus.Connecting;
            _ws.Connect();
        }

        public void Reconnect()
        {
            Error = null;
            CloseReason = null;
            Connect();
        }

        public void Dispatch()
        {
            _ws?.DispatchMessageQueue();
        }

        public void Close()
        {
            _ws?.Close();
        }

        public void StoreAuthToken(string token, string username)
        {
            _storedToken = token;
            PlayerPrefs.SetString(TokenPrefKey, token);
            PlayerPrefs.SetString(UsernamePrefKey, username ?? "");
            PlayerPrefs.Save();
            if (Connected)
                Authenticate(token);
        }

        public void ClearAuthToken()
        {
            _storedToken = null;
            PlayerPrefs.DeleteKey(TokenPrefKey);
            PlayerPrefs.DeleteKey(UsernamePrefKey);
            PlayerPrefs.Save();
            AuthUserId = null;
            AuthUsername = null;
            AuthError = null;
        }

        public void Authenticate(string token)
        {
            var intent = new AuthenticateIntent { token = token };
            Send(JsonConvert.SerializeObject(intent));
        }

        public void JoinQueue()
        {
            Send(JsonConvert.SerializeObject(new JoinQueueIntent()));
        }

        public void LeaveQueue()
        {
            Send(JsonConvert.SerializeObject(new LeaveQueueIntent()));
        }

        public void CreateLobby()
        {
            Send(JsonConvert.SerializeObject(new CreateLobbyIntent()));
        }

        public void JoinLobby(string code)
        {
            Send(JsonConvert.SerializeObject(new JoinLobbyIntent { code = code?.Trim().ToUpper() ?? "" }));
        }

        public void LeaveLobby()
        {
            Send(JsonConvert.SerializeObject(new LeaveLobbyIntent()));
        }

        public void PlayCreature(string cardInstanceId, int? boardIndex = null)
        {
            Send(JsonConvert.SerializeObject(new PlayCreatureIntent { cardInstanceId = cardInstanceId, boardIndex = boardIndex }));
        }

        public void PlaySpell(string cardInstanceId, string targetId = null)
        {
            Send(JsonConvert.SerializeObject(new PlaySpellIntent { cardInstanceId = cardInstanceId, targetId = targetId }));
        }

        public void Attack(string attackerInstanceId, string targetId)
        {
            Send(JsonConvert.SerializeObject(new AttackIntent { attackerInstanceId = attackerInstanceId, targetId = targetId }));
        }

        public void EndTurn()
        {
            Send(JsonConvert.SerializeObject(new EndTurnIntent()));
        }

        private void Send(string json)
        {
            if (Connected) _ws.Send(json);
        }

        private void HandleOpen()
        {
            Status = ConnectionStatus.Connected;
            if (!string.IsNullOrEmpty(_storedToken))
                Authenticate(_storedToken);
        }

        private void HandleMessage(string json)
        {
            try
            {
                var obj = JObject.Parse(json);
                var type = obj["type"]?.ToString();

                switch (type)
                {
                    case "connected":
                        Error = null;
                        MatchmakingMessage = obj["message"]?.ToString();
                        break;
                    case "joined_queue":
                        Error = null;
                        MatchmakingStatus = MatchmakingStatus.Queued;
                        MatchmakingMessage = obj["message"]?.ToString();
                        LobbyCode = null;
                        break;
                    case "left_queue":
                        MatchmakingStatus = MatchmakingStatus.Idle;
                        MatchmakingMessage = null;
                        break;
                    case "lobby_created":
                        Error = null;
                        MatchmakingStatus = MatchmakingStatus.LobbyHost;
                        LobbyCode = obj["code"]?.ToString();
                        MatchmakingMessage = obj["message"]?.ToString();
                        break;
                    case "lobby_joined":
                        LobbyCode = obj["code"]?.ToString();
                        MatchmakingMessage = obj["message"]?.ToString();
                        break;
                    case "lobby_error":
                        MatchmakingStatus = MatchmakingStatus.Idle;
                        LobbyCode = null;
                        Error = obj["error"]?.ToString();
                        MatchmakingMessage = Error;
                        break;
                    case "matchmaking_error":
                        MatchmakingMessage = obj["error"]?.ToString();
                        Error = obj["error"]?.ToString();
                        break;
                    case "authenticated":
                        AuthUserId = obj["userId"]?.ToString();
                        AuthUsername = obj["username"]?.ToString();
                        AuthError = null;
                        break;
                    case "auth_error":
                        AuthUserId = null;
                        AuthUsername = null;
                        AuthError = obj["error"]?.ToString();
                        break;
                    case "state":
                        State = obj["state"]?.ToObject<GameState>();
                        PlayerIndex = obj["playerIndex"] != null ? (int?)obj["playerIndex"].Value<int>() : null;
                        Error = obj["error"]?.ToString();
                        OpponentUsername = obj["opponentUsername"]?.ToString();
                        MatchmakingStatus = MatchmakingStatus.Idle;
                        LobbyCode = null;
                        MatchmakingMessage = null;
                        OnStateChanged?.Invoke();
                        break;
                }
            }
            catch (Exception e)
            {
                Error = "Invalid message: " + e.Message;
            }
        }

        private void HandleClose(ushort code, string reason)
        {
            Status = ConnectionStatus.Closed;
            AuthUserId = null;
            AuthUsername = null;
            if (code == 4000 && reason == "Game full")
                CloseReason = "Game full (2 players already connected). Use Join queue or a lobby code instead.";
            else if (code != 1000)
                CloseReason = string.IsNullOrEmpty(reason) ? "Connection closed. Is the server running?" : reason;
            else
                CloseReason = reason;
        }

        private void HandleError(string msg)
        {
            Status = ConnectionStatus.Error;
            Error = "Cannot reach server at " + _serverUrl + ". " + msg;
        }
    }
}
