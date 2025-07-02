import { Socket } from "net";
import type { IMCPClient } from "../interface";

export class SocketMCPClient implements IMCPClient {
  private host: string;
  private port: number;
  private requestId: number;
  private socket: Socket;
  private buffer: string;
  private pending: Map<number, (msg: any) => void>;

  constructor(host = "127.0.0.1", port = 4000) {
    this.host = host;
    this.port = port;
    this.requestId = 0;
    this.buffer = "";
    this.pending = new Map();
    this.socket = new Socket();
    this.socket.setEncoding("utf-8");
    this.socket.on("data", (data) => {
      this.buffer += data;
      let idx;
      while ((idx = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && this.pending.has(msg.id)) {
            this.pending.get(msg.id)?.(msg);
            this.pending.delete(msg.id);
          }
        } catch {}
      }
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.connect(this.port, this.host);
      this.socket.on("connect", resolve);
      this.socket.on("error", reject);
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket.destroyed) return resolve();
      this.socket.end(() => resolve());
      this.socket.on("close", resolve);
      this.socket.on("error", resolve);
    });
  }

  async listTools(): Promise<any> {
    return this._sendRequest("tools/list", {});
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    return this._sendRequest("tools/call", { name, arguments: args });
  }

  private _sendRequest(method: string, params: any = {}): Promise<any> {
    const id = ++this.requestId;

    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, (msg) => {
        if (msg.error) {
          reject(new Error(msg.error.message || "Request failed"));
        } else {
          resolve(msg.result);
        }
      });
      this.socket.write(JSON.stringify(request) + "\n");
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("Timeout waiting for response"));
        }
      }, 5000);
    });
  }
}
