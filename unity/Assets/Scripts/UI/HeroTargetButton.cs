// Hero target button - attach to hero display. When in spell/attack target mode, click sends target to GameScreen.
// Set isOpponent=true for opponent hero, false for your hero. heroIndex is derived from playerIndex.

using UnityEngine;
using UnityEngine.UI;

namespace TCG.UI
{
    [RequireComponent(typeof(Button))]
    public class HeroTargetButton : MonoBehaviour
    {
        public GameScreen gameScreen;
        [Tooltip("True = opponent's hero, False = your hero")]
        public bool isOpponent;

        void Start()
        {
            GetComponent<Button>().onClick.AddListener(OnClick);
        }

        void OnClick()
        {
            if (gameScreen == null || !gameScreen.IsSpellTargetMode && !gameScreen.IsAttackMode) return;
            var idx = gameScreen.client?.PlayerIndex ?? 0;
            var heroIdx = isOpponent ? (1 - idx) : idx;
            gameScreen.OnTargetClicked("hero-" + heroIdx);
        }
    }
}
