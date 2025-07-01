#!/usr/bin/env bun

import { spawn } from "child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "fs";
import { join } from "path";

const requestsDir = "mailbox-requests";
const responsesDir = "mailbox-responses";

if (!existsSync(requestsDir)) mkdirSync(requestsDir);
if (!existsSync(responsesDir)) mkdirSync(responsesDir);

// Spawn the standard MCP server as a child process
const serverProcess = spawn("bun", ["run", "src/server/server.ts"], {
  stdio: ["pipe", "pipe", "inherit"],
});

// Map of request id to {resolve, reject}
const pending: Map<number, (msg: any) => void> = new Map();

// Listen for responses from the server
let buffer = "";
serverProcess.stdout.on("data", (data) => {
  buffer += data.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)?.(msg);
        pending.delete(msg.id);
      }
    } catch (e) {
      console.error("Failed to parse server response:", e, line);
    }
  }
});

function forwardToServer(request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    pending.set(request.id, resolve);
    serverProcess.stdin.write(JSON.stringify(request) + "\n");
  });
}

function processMailboxRequests() {
  const files = readdirSync(requestsDir).filter(
    (f) => f.startsWith("request-") && f.endsWith(".json")
  );
  for (const file of files) {
    const reqPath = join(requestsDir, file);
    const content = readFileSync(reqPath, "utf-8");
    const req = JSON.parse(content);
    forwardToServer(req)
      .then((response) => {
        const resPath = join(responsesDir, `response-${req.id}.json`);
        writeFileSync(resPath, JSON.stringify(response));
        unlinkSync(reqPath);
      })
      .catch((err) => {
        console.error("Error forwarding request to server:", err);
        unlinkSync(reqPath);
      });
  }
}

setInterval(processMailboxRequests, 100);

process.on("SIGINT", () => {
  serverProcess.kill();
  process.exit(0);
});
