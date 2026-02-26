// Board slot - drop target for creatures. Attach to each of the 7 board slots.
// When a hand card is dropped here, GameScreen.OnHandCardDroppedOnSlot is called.

using UnityEngine;
using UnityEngine.EventSystems;

namespace TCG.UI
{
    public class BoardSlotView : MonoBehaviour, IDropHandler
    {
        public int slotIndex;
        public GameScreen gameScreen;

        public void OnDrop(PointerEventData eventData)
        {
            if (gameScreen == null) return;
            var drag = eventData.pointerDrag?.GetComponent<CardDragHandler>();
            if (drag != null)
                gameScreen.OnHandCardDroppedOnSlot(drag.CardInstanceId, slotIndex);
        }
    }
}
