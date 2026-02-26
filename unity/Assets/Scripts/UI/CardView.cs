// Card view - displays one card (hand or board). Assign to card prefab.
// Hand cards: use mode=Hand, wire OnPlayCreature/OnPlaySpell/OnStartSpellTarget.
// Board cards: use mode=Board, wire OnAttack/OnSpellTarget.

using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using TCG;
using TCG.Game;

namespace TCG.UI
{
    public class CardView : MonoBehaviour, IPointerClickHandler
    {
        public enum Mode { Hand, Board }

        public Mode mode = Mode.Hand;
        public Text costText;
        public Text nameText;
        public Text statsText;
        public Text keywordsText;
        public Button playButton;
        public Button attackButton;
        public Button spellTargetButton;
        public CardDragHandler dragHandler;

        private CardInstance _card;
        private CardTemplate _template;
        private GameState _state;
        private int _myIndex;
        private bool _isMyTurn;
        private GameScreen _gameScreen;
        private int _boardSlotIndex = -1;

        public void Setup(CardInstance card, GameState state, int myIndex, bool isMyTurn, GameScreen gameScreen, int boardSlotIndex = -1)
        {
            _card = card;
            _template = CardCatalog.GetTemplate(card?.cardId);
            _state = state;
            _myIndex = myIndex;
            _isMyTurn = isMyTurn;
            _gameScreen = gameScreen;
            _boardSlotIndex = boardSlotIndex;

            if (_template == null) return;

            if (costText) costText.text = _template.cost.ToString();
            if (nameText) nameText.text = _template.name ?? _template.id;
            if (keywordsText) keywordsText.text = _template.keywords != null ? string.Join(" ", _template.keywords) : "";

            if (_template.type == "creature")
            {
                var atk = CardHelper.EffectiveAttack(_template, _card);
                var maxHp = CardHelper.EffectiveMaxHealth(_template, _card);
                var curHp = CardHelper.CurrentHealth(_card, _template);
                if (statsText) statsText.text = mode == Mode.Board ? atk + " / " + (maxHp > (_template.health ?? 0) ? curHp + "/" + maxHp : curHp.ToString()) : atk + "/" + (_template.health ?? 0);
            }
            else if (_template.type == "spell")
            {
                if (statsText) statsText.text = CardHelper.SpellDescription(_template);
            }

            bool canAfford = _state != null && _state.winner == null && _state.manaRemaining >= _template.cost;
            bool spellNeedsTarget = _template.type == "spell" && CardHelper.SpellRequiresTarget(_template);
            bool attacked = _card?.attackedThisTurn ?? false;

            if (playButton)
            {
                playButton.gameObject.SetActive(mode == Mode.Hand && canAfford && _isMyTurn && (_template.type == "creature" || (_template.type == "spell" && !spellNeedsTarget)));
                playButton.onClick.RemoveAllListeners();
                playButton.onClick.AddListener(OnPlayClick);
            }
            if (attackButton)
            {
                attackButton.gameObject.SetActive(mode == Mode.Board && _isMyTurn && !attacked && !_gameScreen.IsSpellTargetMode);
                attackButton.onClick.RemoveAllListeners();
                attackButton.onClick.AddListener(OnAttackClick);
            }
            if (spellTargetButton)
            {
                spellTargetButton.gameObject.SetActive(mode == Mode.Hand && canAfford && _isMyTurn && spellNeedsTarget);
                spellTargetButton.onClick.RemoveAllListeners();
                spellTargetButton.onClick.AddListener(OnSpellTargetClick);
            }
            if (dragHandler != null && mode == Mode.Hand) dragHandler.CardInstanceId = _card?.instanceId ?? "";
        }

        void OnPlayClick()
        {
            if (_card == null || _gameScreen == null) return;
            if (_template.type == "creature")
                _gameScreen.OnHandCardPlayCreature(_card.instanceId);
            else if (_template.type == "spell" && !CardHelper.SpellRequiresTarget(_template))
                _gameScreen.OnHandCardPlaySpellNoTarget(_card.instanceId);
        }

        void OnAttackClick()
        {
            if (_card != null && _gameScreen != null)
                _gameScreen.OnBoardCreatureAttack(_card.instanceId);
        }

        void OnSpellTargetClick()
        {
            if (_card != null && _gameScreen != null)
                _gameScreen.OnHandCardStartSpellTarget(_card.instanceId);
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if (_gameScreen == null || _card == null) return;
            if (mode == Mode.Board && (_gameScreen.IsSpellTargetMode || _gameScreen.IsAttackMode))
                _gameScreen.OnTargetClicked(_card.instanceId);
        }

        public string InstanceId => _card?.instanceId;
        public string CardId => _card?.cardId;
    }
}
