// Game manager - orchestrates connection, screens, card catalog.
// Attach to a persistent GameObject (or use DontDestroyOnLoad).

using System.Threading.Tasks;
using UnityEngine;
using TCG;
using TCG.Game;
using TCG.Network;
using TCG.Auth;
using TCG.UI;

namespace TCG
{
    public class GameManager : MonoBehaviour
    {
        public TCGConfig config;
        public GameObject lobbyScreenObj;
        public GameObject gameScreenObj;
        public GameObject connectingObj;
        public GameObject errorObj;
        public UnityEngine.UI.Text errorText;

        private TCGGameClient _client;
        private AuthManager _auth;
        private LobbyScreen _lobbyScreen;
        private GameScreen _gameScreen;
        private bool _catalogLoaded;

        void Start()
        {
            if (config == null)
            {
                config = Resources.Load<TCGConfig>("TCGConfig");
                if (config == null) config = ScriptableObject.CreateInstance<TCGConfig>();
            }
            var wsUrl = config?.serverWsUrl ?? "ws://localhost:8765";
            _client = new TCGGameClient(wsUrl);
            _auth = new AuthManager(config?.neonAuthUrl ?? "");
            _lobbyScreen = lobbyScreenObj?.GetComponent<LobbyScreen>();
            _gameScreen = gameScreenObj?.GetComponent<GameScreen>();
            if (_lobbyScreen != null)
            {
                _lobbyScreen.config = config;
                _lobbyScreen.client = _client;
                _lobbyScreen.auth = _auth;
            }
            if (_gameScreen != null)
                _gameScreen.client = _client;
            _client.OnStateChanged += OnStateChanged;
            _ = LoadCatalogAndConnect();
        }

        async Task LoadCatalogAndConnect()
        {
            var baseUrl = CardCatalog.WsToHttp(config?.serverWsUrl ?? "ws://localhost:8765");
            await CardCatalog.LoadAsync(baseUrl);
            _catalogLoaded = true;
            _client.Connect();
        }

        void OnStateChanged()
        {
        }

        void Update()
        {
            _client?.Dispatch();
            if (_client == null) return;
            if (connectingObj) connectingObj.SetActive(!_client.Connected && _client.Status != ConnectionStatus.Error);
            if (errorObj)
            {
                var showErr = _client.Status == ConnectionStatus.Error || _client.Status == ConnectionStatus.Closed;
                errorObj.SetActive(showErr);
            }
            if (errorText) errorText.text = _client.CloseReason ?? _client.Error ?? "";
            var inGame = _client.State != null;
            if (lobbyScreenObj) lobbyScreenObj.SetActive(!inGame);
            if (gameScreenObj) gameScreenObj.SetActive(inGame);
        }

        public void Reconnect()
        {
            _client?.Reconnect();
        }

        void OnDestroy()
        {
            _client?.Close();
        }
    }
}
