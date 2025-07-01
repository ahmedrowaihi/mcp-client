#!/usr/bin/env bun

import { MailboxMCPClient } from "./mailbox-client";
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

async function main() {
  const client = new MailboxMCPClient();
  while (true) {
    // List available tools
    const toolsResult: any = client.listTools();
    const tools = toolsResult.result?.tools || [];
    if (!tools.length) {
      console.log("No tools available.");
      break;
    }
    tools.forEach((t: any, i: number) => {
      console.log(`[${i}] ${t.name}`);
    });
    const toolInput = await prompt(
      "Select a tool by number (or type 'exit' to quit): "
    );
    if (toolInput.trim().toLowerCase() === "exit") break;
    const toolIndex = parseInt(toolInput, 10);
    if (isNaN(toolIndex) || toolIndex < 0 || toolIndex >= tools.length) {
      console.log("Invalid selection.");
      continue;
    }
    const selectedTool = tools[toolIndex];
    let argsObj = {};
    const argStr = await prompt(
      `Enter arguments as JSON for ${selectedTool.name}: `
    );
    try {
      argsObj = argStr.trim() ? JSON.parse(argStr) : {};
    } catch {
      console.log("Invalid JSON. Using empty arguments.");
    }
    try {
      const result = client.callTool(selectedTool.name, argsObj);
      console.log("Tool result:", result);
    } catch (error) {
      console.log("Tool call failed:", (error as Error).message);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
