/**
 * Builds the read-only MCP server. Every resource read and tool call routes
 * through ApiClient.getVerified(), so nothing is returned that hasn't matched
 * the signed manifest. There are no write/mutating tools by design.
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "./config.js";
import { ApiClient, VerificationError, type VerifiedArtifact } from "./api.js";
import {
  POST_URI_PREFIX,
  STATIC_RESOURCES,
  postFile,
  slugFromPostUri,
} from "./catalog.js";

const PKG_VERSION = "0.1.0";

function verificationMeta(a: VerifiedArtifact, signatureNote: string) {
  return {
    verification: {
      path: a.verification.path,
      source: a.url,
      sha256: a.verification.actual,
      matchedSignedManifest: true,
      manifestSignature: signatureNote,
    },
  };
}

interface PostItem {
  slug?: string;
  title?: string;
  summary?: string;
}

export function buildServer(config: Config, client = new ApiClient(config)): McpServer {
  const server = new McpServer(
    { name: "site-mcp", version: PKG_VERSION },
    {
      instructions:
        `Read-only access to ${config.baseUrl}'s signed static API. Every ` +
        `resource and tool result is verified byte-for-byte against the site's ` +
        `Sigstore-signed sha256 manifest before being returned; a mismatch is an error.`,
    },
  );

  async function signatureNote(): Promise<string> {
    const { signature } = await client.getManifest();
    if (config.signatureMode === "off") return "not-checked (disabled)";
    return signature.verified
      ? "verified"
      : `unverified (${signature.reason ?? "unknown"})`;
  }

  // ---- Static resources (one per api/v1 file) ----
  for (const r of STATIC_RESOURCES) {
    server.resource(
      r.name,
      r.uri,
      { description: r.description, mimeType: "application/json" },
      async (uri: URL) => {
        const artifact = await client.getVerified(client.apiPath(r.file));
        return {
          contents: [
            { uri: uri.href, mimeType: "application/json", text: artifact.text },
          ],
          _meta: verificationMeta(artifact, await signatureNote()),
        };
      },
    );
  }

  // ---- Templated resource: individual posts ----
  server.resource(
    "post",
    new ResourceTemplate(`${POST_URI_PREFIX}{slug}`, {
      list: async () => {
        const posts = await client.getVerified(client.apiPath("posts.json"));
        const items = ((posts.json as { items?: PostItem[] }).items ?? []).filter(
          (i) => typeof i.slug === "string",
        );
        return {
          resources: items.map((i) => ({
            uri: `${POST_URI_PREFIX}${i.slug}`,
            name: i.title ?? i.slug!,
            description: i.summary,
            mimeType: "application/json",
          })),
        };
      },
    }),
    { description: "A single blog post by slug.", mimeType: "application/json" },
    async (uri: URL) => {
      const slug = slugFromPostUri(uri.href);
      if (!slug) throw new VerificationError(`invalid post URI: ${uri.href}`);
      const artifact = await client.getVerified(client.apiPath(postFile(slug)));
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: artifact.text },
        ],
        _meta: verificationMeta(artifact, await signatureNote()),
      };
    },
  );

  // ---- Tools (read-only) ----
  const toolResult = async (artifact: VerifiedArtifact) => ({
    content: [{ type: "text" as const, text: artifact.text }],
    structuredContent: artifact.json as Record<string, unknown>,
    _meta: verificationMeta(artifact, await signatureNote()),
  });

  server.tool(
    "list_posts",
    "List published blog posts (slug, title, summary, tags) from the signed posts feed.",
    async () => toolResult(await client.getVerified(client.apiPath("posts.json"))),
  );

  server.tool(
    "get_post",
    "Fetch a single blog post by slug, verified against the signed manifest.",
    { slug: z.string().min(1).describe("Post slug, e.g. agent-authored-code-drift") },
    async ({ slug }: { slug: string }) =>
      toolResult(await client.getVerified(client.apiPath(postFile(slug)))),
  );

  server.tool(
    "get_conformance",
    "Fetch the site's per-page DOM conformance / accessibility report.",
    async () =>
      toolResult(await client.getVerified(client.apiPath("conformance.json"))),
  );

  return server;
}
