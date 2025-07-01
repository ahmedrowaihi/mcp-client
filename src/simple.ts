#!/usr/bin/env node

import { MCPClient } from "./impl/mcp-client";

let client: MCPClient = null!;

async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: bun run src/simple.ts <server-command> [args...]");
    process.exit(1);
  }

  const [, , command, ...args] = process.argv;
  client = new MCPClient(command, args);

  try {
    console.log("Connecting to MCP server...");
    await client.connect();
    console.log("Connected and initialized!");

    await client.initialize();

    const toolsResult: any = await client.listTools();
    const tools = toolsResult.tools;
    console.log("---- tools ----");
    tools.forEach((t: any, i: number) => {
      console.log(`[${i}] ${t.name} - ${t.description}`);
    });
    console.log("---------------");

    // info tool
    const infoResult: any = await client.callTool("get-info");
    console.log("---- info tool result ----");
    console.log(infoResult);
    console.log("---------------------------");

    // call greet tool
    const result = await client.callTool("greet");
    console.log("---- greet tool result ----");
    console.log(result);
    console.log("---------------------------");
  } catch (error) {
    console.error("Error:", (error as Error).message);
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

process.on("SIGINT", async () => {
  console.log("\nCaught interrupt signal (Ctrl+C), shutting down...");
  if (client) {
    await client.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nCaught termination signal, shutting down...");
  if (client) {
    await client.close();
  }
  process.exit(0);
});
