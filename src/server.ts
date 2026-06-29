/**
 * Assemble robertdelanghe.dev's {@link StaticMcpSpec} (verbs + resource catalog
 * + server identity) and hand it to the generic core. All the verified-fetch /
 * manifest / Sigstore machinery and the VerbSpec → MCP projection live in
 * `@bounded-systems/static-mcp`; this file is just the site's values.
 */
import {
  ApiClient,
  buildVerifiedStaticServer,
  type Config,
  type StaticDeps,
  type StaticMcpSpec,
  type VerifiedResource,
} from "@bounded-systems/static-mcp";
import {
  POST_URI_PREFIX,
  postFile,
  slugFromPostUri,
  STATIC_FILES,
} from "./catalog.js";
import { siteVerbs } from "./verbs.js";

const PKG_VERSION = "0.2.0";

interface PostItem {
  slug?: string;
  title?: string;
  summary?: string;
}

/** Build the full spec the core serves: site verbs + resources + identity. */
export function buildSiteSpec(config: Config): StaticMcpSpec {
  const resources: VerifiedResource[] = STATIC_FILES.map((r) => ({
    uri: r.uri,
    name: r.name,
    description: r.description,
    path: `${config.apiPrefix}/${r.file}`,
  }));

  return {
    server: {
      name: "site-mcp",
      version: PKG_VERSION,
      instructions:
        `Read-only access to ${config.baseUrl}'s signed static API. Every ` +
        `resource and tool result is verified byte-for-byte against the site's ` +
        `Sigstore-signed sha256 manifest before being returned; a mismatch is an error.`,
    },
    verbs: siteVerbs,
    resources,
    resourceTemplates: [
      {
        name: "post",
        template: `${POST_URI_PREFIX}{slug}`,
        description: "A single blog post by slug.",
        resolve: (uri: URL, deps: StaticDeps) => {
          const slug = slugFromPostUri(uri.href);
          return slug ? deps.apiPath(postFile(slug)) : undefined;
        },
        list: async (deps: StaticDeps) => {
          const posts = await deps.client.getVerified(deps.apiPath("posts.json"));
          const items = ((posts.json as { items?: PostItem[] }).items ?? []).filter(
            (i) => typeof i.slug === "string",
          );
          return items.map((i) => ({
            uri: `${POST_URI_PREFIX}${i.slug}`,
            name: i.title ?? i.slug!,
            description: i.summary,
          }));
        },
      },
    ],
  };
}

/**
 * Build (but do not connect) the site's MCP server. A test can inject a fake
 * {@link ApiClient} (backed by an in-memory fetch) to exercise the wiring
 * offline; production omits it and the core constructs a real one.
 */
export function buildServer(config: Config, client?: ApiClient) {
  return buildVerifiedStaticServer(buildSiteSpec(config), config, client);
}
