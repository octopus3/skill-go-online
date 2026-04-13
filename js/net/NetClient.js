export class NetClient {
  /**
   * @param {{ url: string, onMessage?: (msg: any) => void, onStatus?: (s: {connected: boolean, message?: string}) => void }} opts
   */
  constructor({ url, onMessage, onStatus } = {}) {
    this.url = url;
    this.ws = null;
    this.clientId = null;
    this.onMessage = onMessage || null;
    this.onStatus = onStatus || null;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.ws = new WebSocket(this.url);
    this.onStatus?.({ connected: false, message: "连接中…" });
    this.ws.addEventListener("open", () => this.onStatus?.({ connected: true, message: "已连接" }));
    this.ws.addEventListener("close", () => this.onStatus?.({ connected: false, message: "连接已断开" }));
    this.ws.addEventListener("error", () => this.onStatus?.({ connected: false, message: "连接错误" }));
    this.ws.addEventListener("message", (e) => {
      let msg;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (msg?.type === "hello") this.clientId = msg.clientId || null;
      this.onMessage?.(msg);
    });
  }

  send(msg) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  join(roomId) {
    return this.send({ type: "join", roomId });
  }
}

