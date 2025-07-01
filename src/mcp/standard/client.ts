import { spawn } from "child_process";
import { createInterface } from "readline";

interface IMCPClient {
  connect(): Promise<any>;
  listTools(): Promise<any>;
  callTool(name: string, args: any): Promise<any>;
  close(): Promise<void>;
}

export class MCPClient implements IMCPClient {
  private command: string;
  private args: string[];
  private process: any;
  private requestId: number;
  private pendingRequests: Map<
    number,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  >;

  constructor(command: string, args: string[] = []) {
    this.command = command;
    this.args = args;
    this.process = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.command, this.args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.process.on("error", reject);
      this.process.on("spawn", () => {
        this.setupMessageHandling();
        this.initialize().then(resolve).catch(reject);
      });
    });
  }

  setupMessageHandling() {
    const rl = createInterface({
      input: this.process.stdout,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      try {
        const message = JSON.parse(line);
        if (message.id && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id) as {
            resolve: (value: any) => void;
            reject: (reason?: any) => void;
          };
          this.pendingRequests.delete(message.id);

          if (message.error) {
            reject(new Error(message.error.message || "Request failed"));
          } else {
            resolve(message.result);
          }
        }
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    });
  }

  async sendRequest(method: string, params: any = {}) {
    const id = ++this.requestId;
    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(message) + "\n");
    });
  }

  async initialize() {
    const result = await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: "simple-mcp-client",
        version: "1.0.0",
      },
    });

    // Send initialized notification
    const notification = {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    };
    this.process.stdin.write(JSON.stringify(notification) + "\n");

    return result;
  }

  async listTools() {
    return await this.sendRequest("tools/list");
  }

  async callTool(name: string, args: any = {}) {
    return await this.sendRequest("tools/call", {
      name,
      arguments: args,
    });
  }

  async close() {
    if (this.process) {
      this.process.kill();
    }
  }
}
