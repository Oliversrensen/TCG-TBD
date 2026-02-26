// Lobby / matchmaking screen. Attach to a Canvas or Panel GameObject.
// Assign references in Inspector. Shown when not in a match.

using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;
using TCG.Network;
using TCG.Auth;

namespace TCG.UI
{
    public class LobbyScreen : MonoBehaviour
    {
        [Header("References")]
        public TCGConfig config;
        public TCGGameClient client;
        public AuthManager auth;

        [Header("Auth Panel")]
        public GameObject authPanel;
        public GameObject loggedInPanel;
        public InputField emailInput;
        public InputField passwordInput;
        public InputField nameInput;
        public GameObject nameInputRow;
        public Button loginButton;
        public Button signupButton;
        public Button switchAuthModeButton;
        public Text switchAuthModeLabel;
        public Text authErrorText;
        public Text loggedInAsText;
        public Button logoutButton;

        [Header("Matchmaking Panel")]
        public GameObject matchmakingPanel;
        public Button joinQueueButton;
        public Button createLobbyButton;
        public InputField lobbyCodeInput;
        public Button joinLobbyButton;
        public Text statusText;

        [Header("Queue Panel")]
        public GameObject queuePanel;
        public Text queueStatusText;
        public Button leaveQueueButton;

        [Header("Lobby Panel")]
        public GameObject lobbyPanel;
        public Text lobbyCodeText;
        public Text lobbyStatusText;

        private bool _authModeLogin = true;

        void Start()
        {
            if (loginButton) loginButton.onClick.AddListener(OnLoginClick);
            if (signupButton) signupButton.onClick.AddListener(OnSignupClick);
            if (switchAuthModeButton) switchAuthModeButton.onClick.AddListener(SwitchAuthMode);
            if (logoutButton) logoutButton.onClick.AddListener(OnLogoutClick);
            if (joinQueueButton) joinQueueButton.onClick.AddListener(() => client?.JoinQueue());
            if (createLobbyButton) createLobbyButton.onClick.AddListener(() => client?.CreateLobby());
            if (joinLobbyButton) joinLobbyButton.onClick.AddListener(OnJoinLobbyClick);
            if (leaveQueueButton) leaveQueueButton.onClick.AddListener(() => client?.LeaveQueue());
            UpdateAuthMode();
            Refresh();
        }

        void Update()
        {
            Refresh();
        }

        void OnLoginClick() => _ = DoAuth(true);
        void OnSignupClick() => _ = DoAuth(false);

        async Task DoAuth(bool isLogin)
        {
            if (auth == null || client == null) return;
            SetAuthError("");
            var email = emailInput?.text?.Trim() ?? "";
            var password = passwordInput?.text ?? "";
            var name = nameInput?.text?.Trim() ?? "";
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
            {
                SetAuthError("Email and password required.");
                return;
            }
            SetButtonsEnabled(false);
            var result = isLogin ? await auth.LoginAsync(email, password) : await auth.RegisterAsync(email, password, name);
            SetButtonsEnabled(true);
            if (result.ok)
            {
                client.StoreAuthToken(result.token, result.username);
                passwordInput.text = "";
                Refresh();
            }
            else
                SetAuthError(result.error ?? "Failed");
        }

        void SwitchAuthMode()
        {
            _authModeLogin = !_authModeLogin;
            SetAuthError("");
            UpdateAuthMode();
        }

        void UpdateAuthMode()
        {
            if (nameInputRow) nameInputRow.SetActive(!_authModeLogin);
            if (loginButton) loginButton.gameObject.SetActive(_authModeLogin);
            if (signupButton) signupButton.gameObject.SetActive(!_authModeLogin);
            if (switchAuthModeLabel) switchAuthModeLabel.text = _authModeLogin ? "Create account" : "Already have account? Sign in";
        }

        void OnLogoutClick()
        {
            auth?.ClearAuthToken();
            client?.ClearAuthToken();
            Refresh();
        }

        void OnJoinLobbyClick()
        {
            var code = lobbyCodeInput?.text?.Trim().ToUpper() ?? "";
            if (code.Length == 6) client?.JoinLobby(code);
        }

        void SetAuthError(string msg)
        {
            if (authErrorText) { authErrorText.text = msg; authErrorText.gameObject.SetActive(!string.IsNullOrEmpty(msg)); }
        }

        void SetButtonsEnabled(bool en)
        {
            if (loginButton) loginButton.interactable = en;
            if (signupButton) signupButton.interactable = en;
        }

        void Refresh()
        {
            if (client == null) return;
            var loggedIn = !string.IsNullOrEmpty(client.AuthUsername);
            if (authPanel) authPanel.SetActive(!loggedIn);
            if (loggedInPanel) loggedInPanel.SetActive(loggedIn);
            if (loggedInAsText) loggedInAsText.text = "Logged in as " + (client.AuthUsername ?? "");

            if (client.AuthError != null) SetAuthError(client.AuthError);

            var canMatch = loggedIn && client.Connected;
            if (matchmakingPanel) matchmakingPanel.SetActive(loggedIn && client.MatchmakingStatus == MatchmakingStatus.Idle);
            if (joinQueueButton) joinQueueButton.interactable = canMatch;
            if (createLobbyButton) createLobbyButton.interactable = canMatch;
            if (joinLobbyButton) joinLobbyButton.interactable = canMatch && (lobbyCodeInput?.text?.Trim().Length == 6);

            if (queuePanel) queuePanel.SetActive(client.MatchmakingStatus == MatchmakingStatus.Queued);
            if (queueStatusText) queueStatusText.text = "Searching for opponent...";
            if (leaveQueueButton) leaveQueueButton.interactable = client.Connected;

            if (lobbyPanel) lobbyPanel.SetActive(client.MatchmakingStatus == MatchmakingStatus.LobbyHost || client.MatchmakingStatus == MatchmakingStatus.LobbyGuest);
            if (lobbyCodeText) lobbyCodeText.text = "Code: " + (client.LobbyCode ?? "");
            if (lobbyStatusText) lobbyStatusText.text = client.MatchmakingMessage ?? "";

            if (statusText)
            {
                if (!client.Connected) statusText.text = "Connecting...";
                else if (!loggedIn) statusText.text = "Sign in to play.";
                else statusText.text = client.MatchmakingMessage ?? "Ready.";
            }
        }
    }
}
