#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer(
  {
    name: "simple-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

server.registerTool(
  "greet",
  {
    description: "Greet someone (no input required)",
    inputSchema: {},
  },
  async () => {
    return {
      content: [
        {
          type: "text",
          text: `Hello, world!`,
        },
      ],
    };
  }
);

server.registerTool(
  "get-info",
  {
    description: "Get structured information about the server",
    inputSchema: {},
    outputSchema: {
      serverName: z.string(),
      version: z.string(),
      timestamp: z.string(),
      toolCount: z.number(),
    },
  },
  async () => {
    const structuredContent = {
      serverName: "simple-mcp-server",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      toolCount: 2,
    };
    return {
      structuredContent,
      content: [
        {
          type: "text",
          text: JSON.stringify(structuredContent, null, 2),
        },
      ],
    };
  }
);

server.prompt(
  "help-prompt",
  "Generate help text for using this server",
  {},
  async () => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Please provide help information for using this MCP server and its available tools.",
          },
        },
      ],
    };
  }
);

server.resource("server-info", "info://server", async () => {
  return {
    contents: [
      {
        uri: "info://server",
        text: "This is a simple MCP server with basic tools and resources.",
        mimeType: "text/plain",
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();

  try {
    await server.connect(transport);
    console.error("MCP Server started and listening on stdio");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}
process.on("SIGINT", async () => {
  console.error("Shutting down server...");
  await server.close();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  console.error("Shutting down server...");
  await server.close();
  process.exit(0);
});

main().catch(console.error);
