// TCG configuration. Create in Project: Right-click > Create > TCG > Config.
// Assign to GameManager in the Inspector.

using UnityEngine;

namespace TCG
{
    [CreateAssetMenu(fileName = "TCGConfig", menuName = "TCG/Config")]
    public class TCGConfig : ScriptableObject
    {
        [Tooltip("WebSocket URL (e.g. ws://localhost:8765)")]
        public string serverWsUrl = "ws://localhost:8765";

        [Tooltip("Neon Auth base URL for login/register (e.g. https://xxx.neonauth.region.aws.neon.tech/neondb/auth). Leave empty to skip auth and use stored token only.")]
        public string neonAuthUrl = "";
    }
}
