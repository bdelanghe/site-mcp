/**
 * The site's resource catalog VALUES (mirrors openapi.json): one stable MCP
 * resource URI per api/v1 file, plus the templated post family. These are the
 * site-specific descriptors the generic core projects to MCP resources.
 */

/** The fixed api/v1 files exposed as `site://…` resources. */
export const STATIC_FILES: {
  uri: string;
  name: string;
  file: string;
  description: string;
}[] = [
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
