#!/usr/bin/env bun

import { SocketMCPClient } from "./socket-client";
import { createInterface } from "readline";

async function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

let client: SocketMCPClient = null!;

async function main() {
  // Usage: bun run src/mcp/socket/interactive-socket.ts [host] [port]
  const host = process.argv[2] || "127.0.0.1";
  const port = process.argv[3] ? parseInt(process.argv[3], 10) : 4000;
  client = new SocketMCPClient(host, port);

  try {
    console.log(`Connecting to MCP socket server at ${host}:${port}...`);
    await client.connect();
    console.log("Connected!");

    while (true) {
      // List available tools
      console.log("\nListing tools...");
      const toolsResult: any = await client.listTools();
      const tools = toolsResult.tools;
      tools.forEach((t: any, i: number) => {
        console.log(`[${i}] ${t.name} - ${t.description}`);
      });

      // Prompt user to select a tool or exit
      const toolInput = await prompt(
        "Select a tool by number (or type 'exit' to quit): "
      );
      if (toolInput.trim().toLowerCase() === "exit") {
        break;
      }
      const toolIndex = parseInt(toolInput, 10);
      if (isNaN(toolIndex) || toolIndex < 0 || toolIndex >= tools.length) {
        console.log("Invalid selection.");
        continue;
      }
      const selectedTool = tools[toolIndex];

      // Prompt user for arguments (as JSON)
      let argsObj = {};
      if (
        selectedTool.inputSchema &&
        Object.keys(selectedTool.inputSchema).length > 0
      ) {
        const argStr = await prompt(
          `Enter arguments as JSON for ${selectedTool.name}: `
        );
        try {
          argsObj = JSON.parse(argStr);
        } catch {
          console.log("Invalid JSON. Using empty arguments.");
        }
      }

      // Call the tool
      try {
        const result = await client.callTool(selectedTool.name, argsObj);
        console.log("Tool result:", result);
      } catch (error) {
        console.log("Tool call failed:", (error as Error).message);
      }
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
  } finally {
    await client.close();
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

process.on("SIGINT", async () => {
  console.log("\nCaught interrupt signal (Ctrl+C), shutting down...");
  await client.close();
});

process.on("SIGTERM", async () => {
  console.log("\nCaught termination signal, shutting down...");
  await client.close();
});
