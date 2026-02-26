// Card catalog - fetches card definitions from GET /card-catalog or uses fallback.
// Server base URL is derived from WebSocket URL (ws://host:port -> http://host:port).

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using TCG;

namespace TCG.Game
{
    public static class CardCatalog
    {
        private static CardTemplate[] _cards;
        private static Dictionary<string, CardTemplate> _byId;

        public static CardTemplate GetTemplate(string cardId)
        {
            if (_byId != null && _byId.TryGetValue(cardId, out var t)) return t;
            return null;
        }

        public static string CardName(string cardId)
        {
            return GetTemplate(cardId)?.name ?? cardId;
        }

        public static CardTemplate[] All => _cards ?? Array.Empty<CardTemplate>();

        public static bool IsLoaded => _cards != null;

        public static async Task LoadAsync(string serverBaseUrl)
        {
            if (string.IsNullOrEmpty(serverBaseUrl)) serverBaseUrl = "http://localhost:8765";
            var url = serverBaseUrl.TrimEnd('/') + "/card-catalog";
            using (var req = UnityWebRequest.Get(url))
            {
                var op = req.SendWebRequest();
                while (!op.isDone) await Task.Yield();
                if (req.result == UnityWebRequest.Result.Success)
                {
                    var json = req.downloadHandler.text;
                    var resp = Newtonsoft.Json.JsonConvert.DeserializeObject<CardCatalogResponse>(json);
                    _cards = resp?.cards ?? Array.Empty<CardTemplate>();
                }
                else
                {
                    Debug.LogWarning("CardCatalog: Failed to fetch " + url + ": " + req.error);
                    _cards = Array.Empty<CardTemplate>();
                }
                _byId = new Dictionary<string, CardTemplate>();
                foreach (var c in _cards)
                    if (!string.IsNullOrEmpty(c?.id)) _byId[c.id] = c;
            }
        }

        public static string WsToHttp(string wsUrl)
        {
            if (string.IsNullOrEmpty(wsUrl)) return "http://localhost:8765";
            if (wsUrl.StartsWith("ws://")) return "http" + wsUrl.Substring(2);
            if (wsUrl.StartsWith("wss://")) return "https" + wsUrl.Substring(3);
            return wsUrl;
        }
    }
}
