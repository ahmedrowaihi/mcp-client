import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "fs";
import { join } from "path";

export class MailboxMCPServer {
  private requestsDir: string;
  private responsesDir: string;
  private tools: Record<string, (args: any) => any>;

  constructor(
    requestsDir = "mailbox-requests",
    responsesDir = "mailbox-responses"
  ) {
    this.requestsDir = requestsDir;
    this.responsesDir = responsesDir;
    this.tools = {};
    if (!existsSync(this.requestsDir)) mkdirSync(this.requestsDir);
    if (!existsSync(this.responsesDir)) mkdirSync(this.responsesDir);
  }

  registerTool(name: string, handler: (args: any) => any) {
    this.tools[name] = handler;
  }

  processRequests() {
    const files = readdirSync(this.requestsDir).filter(
      (f) => f.startsWith("request-") && f.endsWith(".json")
    );
    for (const file of files) {
      const reqPath = join(this.requestsDir, file);
      const content = readFileSync(reqPath, "utf-8");
      const req = JSON.parse(content);
      let response: any = {
        jsonrpc: "2.0",
        id: req.id,
      };
      if (req.method === "tools/list") {
        response.result = {
          tools: Object.keys(this.tools).map((name) => ({ name })),
        };
      } else if (req.method === "tools/call") {
        const toolName = req.params?.name;
        const args = req.params?.arguments || {};
        if (this.tools[toolName]) {
          try {
            response.result = this.tools[toolName](args);
          } catch (e: any) {
            response.error = { code: -32000, message: e.message };
          }
        } else {
          response.error = { code: -32601, message: "Tool not found" };
        }
      } else if (req.method === "initialize") {
        response.result = { capabilities: { tools: {} } };
      } else {
        response.error = { code: -32601, message: "Method not found" };
      }
      const resPath = join(this.responsesDir, `response-${req.id}.json`);
      writeFileSync(resPath, JSON.stringify(response));
      unlinkSync(reqPath); // Clean up request file after processing
    }
  }

  startPolling(intervalMs = 100) {
    setInterval(() => this.processRequests(), intervalMs);
  }
}
