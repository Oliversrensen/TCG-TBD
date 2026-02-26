// Card drag handler - attach to hand card prefab for drag-to-board.
// Requires a Canvas Group (optional) for raycast during drag.

using UnityEngine;
using UnityEngine.EventSystems;

namespace TCG.UI
{
    public class CardDragHandler : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        public string CardInstanceId { get; set; }
        private RectTransform _rt;
        private Canvas _canvas;
        private Vector2 _offset;

        void Awake()
        {
            _rt = GetComponent<RectTransform>();
            _canvas = GetComponentInParent<Canvas>();
        }

        public void OnBeginDrag(PointerEventData eventData)
        {
            if (_canvas != null)
                _offset = _rt.anchoredPosition - (Vector2)eventData.position;
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (_canvas != null)
                _rt.anchoredPosition = (Vector2)eventData.position + _offset;
        }

        public void OnEndDrag(PointerEventData eventData)
        {
            _offset = Vector2.zero;
        }
    }
}
