#!/usr/bin/env node
/**
 * Entry point: a local, read-only MCP server over robertdelanghe.dev's signed
 * static API, speaking the stdio transport. No network listener is opened — the
 * server is launched by an MCP client and talks over stdin/stdout.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveConfig } from "./config.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = resolveConfig();
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only — stdout is the MCP channel.
  console.error(
    `site-mcp ready (stdio) → ${config.baseUrl}; signature mode=${config.signatureMode}`,
  );
}

main().catch((err) => {
  console.error("site-mcp failed to start:", err);
  process.exit(1);
});
