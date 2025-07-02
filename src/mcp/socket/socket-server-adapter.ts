#!/usr/bin/env bun

import { createServer, Socket } from "net";
import { spawn } from "child_process";

const PORT = 4000;

// Spawn the standard MCP server as a child process
const serverProcess = spawn("bun", ["run", "src/server/server.ts"], {
  stdio: ["pipe", "pipe", "inherit"],
});

// Map of request id to {resolve, socket}
const pending: Map<number, { resolve: (msg: any) => void; socket: Socket }> =
  new Map();

// Listen for responses from the server :D
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
        const { resolve } = pending.get(msg.id)!;
        resolve(msg);
        pending.delete(msg.id);
      }
    } catch (e) {
      console.error("Failed to parse server response:", e, line);
    }
  }
});

const tcpServer = createServer((socket) => {
  socket.setEncoding("utf-8");
  let sockBuffer = "";
  socket.on("data", (data) => {
    sockBuffer += data;
    let idx;
    while ((idx = sockBuffer.indexOf("\n")) !== -1) {
      const line = sockBuffer.slice(0, idx);
      sockBuffer = sockBuffer.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const req = JSON.parse(line);
        // Forward to server
        pending.set(req.id, {
          resolve: (response) => {
            socket.write(JSON.stringify(response) + "\n");
          },
          socket,
        });
        serverProcess.stdin.write(JSON.stringify(req) + "\n");
      } catch (e) {
        console.error("Failed to parse request from socket:", e, line);
      }
    }
  });
  socket.on("error", (err) => {
    console.error("Socket error:", err);
  });
});

tcpServer.listen(PORT, () => {
  console.log(`Socket MCP server adapter listening on port ${PORT}`);
});

process.on("SIGINT", () => {
  serverProcess.kill();
  tcpServer.close();
  process.exit(0);
});
