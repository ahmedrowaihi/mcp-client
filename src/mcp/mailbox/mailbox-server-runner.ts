#!/usr/bin/env bun

import { MailboxMCPServer } from "./mailbox-server";

const server = new MailboxMCPServer();

server.registerTool("get-info", () => ({
  content: [{ type: "text", text: "This is a mailbox MCP server." }],
}));

server.registerTool("greet", ({ name }) => ({
  content: [{ type: "text", text: `Hello, ${name || "world"}!` }],
}));

server.startPolling();
