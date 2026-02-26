// TCG WebSocket wrapper. Requires NativeWebSocket package.
// Install via Package Manager: Add package from git URL:
//   https://github.com/endel/NativeWebSocket.git#upm

using System;
using NativeWebSocket;

namespace TCG.Network
{
    public class TCGWebSocket
    {
        private WebSocket _ws;
        private readonly string _url;
        private bool _disposed;

        public event Action OnOpen;
        public event Action<string> OnError;
        public event Action<ushort, string> OnClose;
        public event Action<string> OnMessage;

        public bool IsConnected => _ws?.State == WebSocketState.Open;
        public WebSocketState State => _ws?.State ?? WebSocketState.None;

        public TCGWebSocket(string url)
        {
            _url = url ?? throw new ArgumentNullException(nameof(url));
        }

        public void Connect()
        {
            if (_ws != null)
            {
                _ws.Close();
                _ws = null;
            }

            _ws = new WebSocket(_url);
            _ws.OnOpen += () => OnOpen?.Invoke();
            _ws.OnError += (msg) => OnError?.Invoke(msg);
            _ws.OnClose += (code, reason) => OnClose?.Invoke(code, reason ?? "");
            _ws.OnMessage += (data) =>
            {
                try
                {
                    var json = System.Text.Encoding.UTF8.GetString(data);
                    OnMessage?.Invoke(json);
                }
                catch (Exception e)
                {
                    OnError?.Invoke($"Parse message: {e.Message}");
                }
            };
            _ws.Connect();
        }

        public void Send(string json)
        {
            if (_ws?.State == WebSocketState.Open && !string.IsNullOrEmpty(json))
                _ws.SendText(json);
        }

        public void DispatchMessageQueue()
        {
            _ws?.DispatchMessageQueue();
        }

        public void Close()
        {
            if (_ws != null && !_disposed)
            {
                _disposed = true;
                _ws.Close();
                _ws = null;
            }
        }
    }
}
