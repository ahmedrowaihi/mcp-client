import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";

export class MailboxMCPClient {
  private requestsDir: string;
  private responsesDir: string;
  private requestId: number;

  constructor(
    requestsDir = "mailbox-requests",
    responsesDir = "mailbox-responses"
  ) {
    this.requestsDir = requestsDir;
    this.responsesDir = responsesDir;
    this.requestId = 0;
    if (!existsSync(this.requestsDir)) mkdirSync(this.requestsDir);
    if (!existsSync(this.responsesDir)) mkdirSync(this.responsesDir);
  }

  sendRequest(request: any) {
    const reqFile = join(this.requestsDir, `request-${request.id}.json`);
    writeFileSync(reqFile, JSON.stringify(request));
  }

  waitForResponse(id: number, timeoutMs = 5000) {
    const resFile = join(this.responsesDir, `response-${id}.json`);
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (existsSync(resFile)) {
        const content = readFileSync(resFile, "utf-8");
        const msg = JSON.parse(content);
        // Clean up after reading
        unlinkSync(resFile);
        return msg;
      }
      // Sleep for a bit before polling again
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
    throw new Error("Timeout waiting for response");
  }

  listTools() {
    const id = ++this.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method: "tools/list",
      params: {},
    };
    this.sendRequest(request);
    return this.waitForResponse(id);
  }

  callTool(name: string, args: any = {}) {
    const id = ++this.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    };
    this.sendRequest(request);
    return this.waitForResponse(id);
  }
}
