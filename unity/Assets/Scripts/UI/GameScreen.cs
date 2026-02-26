// Game screen - board, hand, heroes, end turn. Attach to the in-game panel.

using UnityEngine;
using UnityEngine.UI;
using TCG;
using TCG.Game;
using TCG.Network;

namespace TCG.UI
{
    public class GameScreen : MonoBehaviour
    {
        public TCGGameClient client;
        public int maxBoardSlots = 7;

        [Header("HUD")]
        public Text manaText;
        public Text turnText;
        public Text winnerText;
        public Text errorText;
        public Text lastActionText;
        public Button endTurnButton;

        [Header("Opponent")]
        public Transform opponentHeroRoot;
        public Text opponentHeroNameText;
        public Text opponentHeroHealthText;
        public Transform opponentBoardRoot;
        public GameObject boardSlotPrefab;

        [Header("Player")]
        public Transform playerHeroRoot;
        public Text playerHeroNameText;
        public Text playerHeroHealthText;
        public Transform playerBoardRoot;
        public Transform handRoot;
        public GameObject cardPrefab;

        [Header("Targeting")]
        public GameObject targetingHintPanel;
        public Text targetingHintText;
        public Button cancelTargetButton;

        private string _attackModeAttacker;
        private string _spellTargetCardId;
        private GameBoardRenderer _boardRenderer;

        void Start()
        {
            _boardRenderer = new GameBoardRenderer(this);
            if (endTurnButton) endTurnButton.onClick.AddListener(OnEndTurn);
            if (cancelTargetButton) cancelTargetButton.onClick.AddListener(CancelTargeting);
        }

        void OnEnable()
        {
            _attackModeAttacker = null;
            _spellTargetCardId = null;
        }

        void Update()
        {
            if (client?.State == null) return;
            _boardRenderer.Refresh(client.State, client.PlayerIndex ?? 0, client.OpponentUsername ?? "Opponent");
        }

        void OnEndTurn()
        {
            client?.EndTurn();
        }

        void CancelTargeting()
        {
            _attackModeAttacker = null;
            _spellTargetCardId = null;
        }

        public void OnHandCardPlayCreature(string instanceId)
        {
            client?.PlayCreature(instanceId);
        }

        public void OnHandCardPlaySpellNoTarget(string instanceId)
        {
            client?.PlaySpell(instanceId);
        }

        public void OnHandCardStartSpellTarget(string instanceId)
        {
            _spellTargetCardId = instanceId;
            _attackModeAttacker = null;
        }

        public void OnBoardCreatureAttack(string instanceId)
        {
            _attackModeAttacker = instanceId;
            _spellTargetCardId = null;
        }

        public void OnTargetClicked(string targetId)
        {
            if (!string.IsNullOrEmpty(_spellTargetCardId))
            {
                client?.PlaySpell(_spellTargetCardId, targetId);
                _spellTargetCardId = null;
            }
            else if (!string.IsNullOrEmpty(_attackModeAttacker))
            {
                client?.Attack(_attackModeAttacker, targetId);
                _attackModeAttacker = null;
            }
        }

        public void OnHandCardDroppedOnSlot(string cardInstanceId, int slotIndex)
        {
            var t = CardCatalog.GetTemplate(
                client?.State?.players?[client.PlayerIndex ?? 0]?.hand?.Find(c => c.instanceId == cardInstanceId)?.cardId);
            if (t?.type == "creature" && slotIndex >= 0 && slotIndex < maxBoardSlots)
                client?.PlayCreature(cardInstanceId, slotIndex);
        }

        public bool IsAttackMode => !string.IsNullOrEmpty(_attackModeAttacker);
        public bool IsSpellTargetMode => !string.IsNullOrEmpty(_spellTargetCardId);
        public string AttackModeAttacker => _attackModeAttacker;
        public string SpellTargetCardId => _spellTargetCardId;
    }

    internal class GameBoardRenderer
    {
        private readonly GameScreen _screen;

        public GameBoardRenderer(GameScreen screen) { _screen = screen; }

        public void Refresh(GameState state, int myIndex, string opponentName)
        {
            var myPlayer = state.players?[myIndex];
            var oppIndex = 1 - myIndex;
            var oppPlayer = state.players?[oppIndex];
            var isMyTurn = state.currentTurn == myIndex && state.winner == null;

            if (_screen.manaText) _screen.manaText.text = "Mana: " + state.manaRemaining + " / 10";
            if (_screen.turnText) _screen.turnText.text = "Turn: " + (isMyTurn ? "You" : opponentName);
            if (_screen.winnerText)
            {
                _screen.winnerText.gameObject.SetActive(state.winner != null);
                _screen.winnerText.text = state.winner == myIndex ? "You win!" : "You lose!";
            }
            if (_screen.errorText) { _screen.errorText.text = state.error ?? ""; _screen.errorText.gameObject.SetActive(!string.IsNullOrEmpty(state.error)); }
            if (_screen.lastActionText) _screen.lastActionText.text = state.lastAction ?? "";
            if (_screen.endTurnButton) _screen.endTurnButton.interactable = isMyTurn;

            if (_screen.targetingHintPanel)
                _screen.targetingHintPanel.SetActive(_screen.IsSpellTargetMode || _screen.IsAttackMode);
            if (_screen.targetingHintText)
                _screen.targetingHintText.text = _screen.IsSpellTargetMode ? "Choose target for spell" : "Choose attack target";

            if (_screen.opponentHeroNameText) _screen.opponentHeroNameText.text = opponentName + "'s hero";
            if (_screen.opponentHeroHealthText) _screen.opponentHeroHealthText.text = "" + (oppPlayer?.heroHealth ?? 0);

            if (_screen.playerHeroNameText) _screen.playerHeroNameText.text = "Your hero";
            if (_screen.playerHeroHealthText) _screen.playerHeroHealthText.text = "" + (myPlayer?.heroHealth ?? 0);

            RefreshBoard(_screen.opponentBoardRoot, _screen.cardPrefab, oppPlayer?.board, state, myIndex, isMyTurn, CardView.Mode.Board, true);
            RefreshBoardSlots(_screen.playerBoardRoot, _screen.boardSlotPrefab, _screen.cardPrefab, myPlayer?.board, state, myIndex, isMyTurn);
            RefreshHand(_screen.handRoot, _screen.cardPrefab, myPlayer?.hand, state, myIndex, isMyTurn);
        }

        private void RefreshBoard(Transform root, GameObject prefab, CardInstance[] board, GameState state, int myIndex, bool isMyTurn, CardView.Mode mode, bool isOpponent)
        {
            if (root == null || prefab == null || board == null) return;
            while (root.childCount > board.Length)
                Object.Destroy(root.GetChild(root.childCount - 1).gameObject);
            for (int i = 0; i < board.Length; i++)
            {
                CardView cv;
                if (i < root.childCount)
                    cv = root.GetChild(i).GetComponent<CardView>();
                else
                {
                    var go = Object.Instantiate(prefab, root);
                    cv = go.GetComponent<CardView>();
                }
                if (cv != null)
                {
                    cv.mode = mode;
                    cv.Setup(board[i], state, myIndex, isMyTurn, _screen, -1);
                }
            }
        }

        private void RefreshBoardSlots(Transform root, GameObject slotPrefab, GameObject cardPrefab, CardInstance[] board, GameState state, int myIndex, bool isMyTurn)
        {
            if (root == null || slotPrefab == null) return;
            var maxSlots = _screen.maxBoardSlots;
            while (root.childCount < maxSlots)
                Object.Instantiate(slotPrefab, root);
            for (int i = 0; i < maxSlots; i++)
            {
                var slot = root.GetChild(i);
                var bs = slot.GetComponent<BoardSlotView>();
                if (bs != null) { bs.slotIndex = i; bs.gameScreen = _screen; }
                var cardRoot = slot;
                if (i < (board?.Length ?? 0) && cardPrefab != null)
                {
                    CardView cv;
                    if (cardRoot.childCount == 0)
                    {
                        var go = Object.Instantiate(cardPrefab, cardRoot);
                        cv = go.GetComponent<CardView>();
                    }
                    else
                        cv = cardRoot.GetChild(0).GetComponent<CardView>();
                    if (cv != null) { cv.mode = CardView.Mode.Board; cv.Setup(board[i], state, myIndex, isMyTurn, _screen, i); }
                }
                else
                {
                    while (cardRoot.childCount > 0)
                        Object.Destroy(cardRoot.GetChild(0).gameObject);
                }
            }
        }

        private void RefreshHand(Transform root, GameObject prefab, CardInstance[] hand, GameState state, int myIndex, bool isMyTurn)
        {
            if (root == null || prefab == null || hand == null) return;
            while (root.childCount > hand.Length)
                Object.Destroy(root.GetChild(root.childCount - 1).gameObject);
            for (int i = 0; i < hand.Length; i++)
            {
                CardView cv;
                if (i < root.childCount)
                    cv = root.GetChild(i).GetComponent<CardView>();
                else
                {
                    var go = Object.Instantiate(prefab, root);
                    cv = go.GetComponent<CardView>();
                }
                if (cv != null)
                    cv.Setup(hand[i], state, myIndex, isMyTurn, _screen);
            }
        }
    }
}
