#!/usr/bin/env node
/**
 * Entry point. Two surfaces from one verb set (see `@bounded-systems/verbspec`):
 *   - `site-mcp` (no args)            → a read-only MCP server over stdio.
 *   - `site-mcp <command> [args]`     → the same verbs as a CLI, e.g.
 *       `site-mcp list_posts` · `site-mcp get_conformance` ·
 *       `site-mcp get_post agent-authored-code-drift`
 * Either way every byte returned is verified against robertdelanghe.dev's signed
 * manifest. All machinery lives in `@bounded-systems/static-mcp`; this just
 * supplies the site's config + spec and picks the surface.
 */
import { runStaticCli, serveVerifiedStaticMcp } from "@bounded-systems/static-mcp";
import { resolveConfig } from "./config.js";
import { buildSiteSpec } from "./server.js";

async function main(): Promise<void> {
  const config = resolveConfig();
  const spec = buildSiteSpec(config);
  const argv = process.argv.slice(2);

  if (argv.length > 0) {
    // CLI surface.
    const { stdout, stderr, code } = await runStaticCli(spec, config, argv);
    if (stdout) process.stdout.write(stdout.endsWith("\n") ? stdout : stdout + "\n");
    if (stderr) process.stderr.write(stderr.endsWith("\n") ? stderr : stderr + "\n");
    process.exit(code);
  }

  // MCP stdio surface (the default when launched by an MCP client).
  await serveVerifiedStaticMcp(spec, config);
}

main().catch((err) => {
  console.error("site-mcp failed to start:", err);
  process.exit(1);
});
