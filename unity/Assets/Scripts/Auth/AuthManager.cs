// Auth manager - calls Neon Auth for login/register, stores token in PlayerPrefs.
// Configure neonAuthUrl in TCGConfig.

using System;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using Newtonsoft.Json.Linq;

namespace TCG.Auth
{
    public class AuthManager
    {
        private readonly string _authBaseUrl;

        public AuthManager(string authBaseUrl)
        {
            _authBaseUrl = (authBaseUrl ?? "").TrimEnd('/');
        }

        public bool IsConfigured => !string.IsNullOrEmpty(_authBaseUrl);

        public async Task<(bool ok, string token, string username, string error)> LoginAsync(string email, string password)
        {
            return await SignInEmailAsync(email, password);
        }

        public async Task<(bool ok, string token, string username, string error)> RegisterAsync(string email, string password, string name)
        {
            return await SignUpEmailAsync(email, password, name ?? email?.Split('@')[0] ?? "User");
        }

        private async Task<(bool ok, string token, string username, string error)> SignInEmailAsync(string email, string password)
        {
            if (!IsConfigured) return (false, null, null, "Auth not configured. Set neonAuthUrl in TCGConfig.");
            var url = _authBaseUrl + "/sign-in/email";
            var body = new { email = email?.Trim(), password };
            return await PostAuthAsync(url, body);
        }

        private async Task<(bool ok, string token, string username, string error)> SignUpEmailAsync(string email, string password, string name)
        {
            if (!IsConfigured) return (false, null, null, "Auth not configured. Set neonAuthUrl in TCGConfig.");
            var url = _authBaseUrl + "/sign-up/email";
            var body = new { email = email?.Trim(), password, name };
            return await PostAuthAsync(url, body);
        }

        private async Task<(bool ok, string token, string username, string error)> PostAuthAsync(string url, object body)
        {
            try
            {
                var json = Newtonsoft.Json.JsonConvert.SerializeObject(body);
                using (var req = new UnityWebRequest(url, "POST"))
                {
                    req.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(json));
                    req.downloadHandler = new DownloadHandlerBuffer();
                    req.SetRequestHeader("Content-Type", "application/json");
                    var op = req.SendWebRequest();
                    while (!op.isDone) await Task.Yield();
                    var responseText = req.downloadHandler?.text ?? "";
                    if (req.result != UnityWebRequest.Result.Success)
                    {
                        try
                        {
                            var errObj = JObject.Parse(responseText);
                            var msg = errObj["message"]?.ToString() ?? errObj["error"]?.ToString() ?? req.error;
                            return (false, null, null, msg ?? "Request failed");
                        }
                        catch { return (false, null, null, req.error ?? "Request failed"); }
                    }
                    var data = JObject.Parse(responseText);
                    var token = data["token"]?.ToString();
                    var user = data["user"] ?? data;
                    var username = user["name"]?.ToString() ?? user["email"]?.ToString() ?? user["id"]?.ToString();
                    if (string.IsNullOrEmpty(token))
                    {
                        var tokenUrl = _authBaseUrl + "/token";
                        using (var tokenReq = UnityWebRequest.Get(tokenUrl))
                        {
                            tokenReq.SetRequestHeader("Cookie", req.GetResponseHeader("Set-Cookie") ?? "");
                            var tokenOp = tokenReq.SendWebRequest();
                            while (!tokenOp.isDone) await Task.Yield();
                            if (tokenReq.result == UnityWebRequest.Result.Success)
                            {
                                var tokenData = JObject.Parse(tokenReq.downloadHandler.text);
                                token = tokenData["token"]?.ToString();
                            }
                        }
                    }
                    if (string.IsNullOrEmpty(token)) return (false, null, null, "No token in response");
                    return (true, token, username, null);
                }
            }
            catch (Exception e) { return (false, null, null, e.Message); }
        }
    }
}
