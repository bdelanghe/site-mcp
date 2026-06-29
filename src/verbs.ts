/**
 * The site's read-only verbs, authored once as `@bounded-systems/verbspec`
 * VerbSpecs (via the core's {@link verifiedVerb} helper). Each one resolves its
 * input to a manifest-relative artifact path; the core fetches + verifies it and
 * projects the verb to an MCP tool. There is no per-tool handler boilerplate and
 * no drift between the verb and its MCP surface.
 */
import { z } from "zod";
import { verifiedVerb, type Registry } from "@bounded-systems/static-mcp";
import { postFile } from "./catalog.js";

/** The robertdelanghe.dev verb registry → MCP tools. */
export const siteVerbs: Registry = {
  list_posts: verifiedVerb({
    id: "list_posts",
    summary:
      "List published blog posts (slug, title, summary, tags) from the signed posts feed.",
    input: z.object({}),
    resolve: (_input, deps) => deps.apiPath("posts.json"),
  }),

  get_post: verifiedVerb({
    id: "get_post",
    summary: "Fetch a single blog post by slug, verified against the signed manifest.",
    input: z.object({
      slug: z.string().min(1).describe("Post slug, e.g. agent-authored-code-drift"),
    }),
    // `slug` is a CLI positional (`site-mcp get_post <slug>`) and the MCP tool's
    // sole input — the same Zod field, both surfaces.
    positionals: ["slug"],
    resolve: ({ slug }, deps) => deps.apiPath(postFile(slug)),
  }),

  get_conformance: verifiedVerb({
    id: "get_conformance",
    summary: "Fetch the site's per-page DOM conformance / accessibility report.",
    input: z.object({}),
    resolve: (_input, deps) => deps.apiPath("conformance.json"),
  }),
};
