/**
 * The fixed set of static resources the API exposes (mirrors openapi.json).
 * Each entry maps a stable MCP resource URI to its api/v1 filename.
 */
export interface StaticResource {
  /** MCP resource URI. */
  uri: string;
  /** Human-readable name. */
  name: string;
  /** Filename under api/v1. */
  file: string;
  description: string;
}

export const STATIC_RESOURCES: StaticResource[] = [
  {
    uri: "site://profile",
    name: "profile",
    file: "profile.json",
    description: "Identity / copy tokens: headline, intro, label, links.",
  },
  {
    uri: "site://posts",
    name: "posts",
    file: "posts.json",
    description: "JSON Feed of writing (list of posts with slugs + summaries).",
  },
  {
    uri: "site://corpus",
    name: "corpus",
    file: "corpus.json",
    description: "Curated GitHub corpus: stats + highlighted repositories.",
  },
  {
    uri: "site://conformance",
    name: "conformance",
    file: "conformance.json",
    description: "Per-page DOM conformance / accessibility report.",
  },
  {
    uri: "site://resume-vc",
    name: "resume-vc",
    file: "resume.vc.json",
    description: "Résumé as a Verifiable Credential (JSON Resume schema).",
  },
  {
    uri: "site://openapi",
    name: "openapi",
    file: "openapi.json",
    description: "The OpenAPI 3.2 document describing this static API.",
  },
];

/** Template URI for individual posts: site://post/{slug} */
export const POST_URI_PREFIX = "site://post/";

/** api/v1 filename for a post slug. */
export function postFile(slug: string): string {
  return `posts/${slug}.json`;
}

/** Extract a slug from a site://post/<slug> URI, or undefined. */
export function slugFromPostUri(uri: string): string | undefined {
  if (!uri.startsWith(POST_URI_PREFIX)) return undefined;
  const slug = uri.slice(POST_URI_PREFIX.length);
  return slug.length ? slug : undefined;
}
