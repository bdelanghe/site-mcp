/**
 * The site's verbs run as a CLI — the SAME verb set that backs the MCP tools,
 * projected to the other surface by `@bounded-systems/static-mcp` (via verbspec).
 * Verified bytes on stdout; a tampered artifact fails closed. No network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiClient, runStaticCli, sha256Hex } from "@bounded-systems/static-mcp";
import { resolveConfig } from "../src/config.js";
import { buildSiteSpec } from "../src/server.js";

const enc = (s: string) => new TextEncoder().encode(s);
const config = resolveConfig({
  SITE_MCP_BASE_URL: "https://example.test",
  SITE_MCP_SIGNATURE_MODE: "off",
} as NodeJS.ProcessEnv);
const spec = buildSiteSpec(config);

function fakeFetch(files: Record<string, string>): typeof fetch {
  return (async (input: any) => {
    const url = typeof input === "string" ? input : input.url;
    const body = files[url];
    if (body === undefined) return new Response("nf", { status: 404, statusText: "Not Found" });
    return new Response(enc(body), { status: 200 });
  }) as unknown as typeof fetch;
}

function fixture(tamper = false) {
  const posts = '{"items":[{"slug":"hi","title":"Hi"}]}';
  const conformance = '{"pages":[]}';
  const post = '{"slug":"hi","title":"Hi"}';
  const at = (p: string) => `https://example.test/${p}`;
  const manifest =
    `${sha256Hex(enc(posts))}  api/v1/posts.json\n` +
    `${sha256Hex(enc(conformance))}  api/v1/conformance.json\n` +
    `${sha256Hex(enc(post))}  api/v1/posts/hi.json\n`;
  return {
    [at("site.sha256")]: manifest,
    [at("api/v1/posts.json")]: tamper ? '{"items":"EVIL"}' : posts,
    [at("api/v1/conformance.json")]: conformance,
    [at("api/v1/posts/hi.json")]: post,
  } as Record<string, string>;
}

const run = (argv: string[], files = fixture()) =>
  runStaticCli(spec, config, argv, new ApiClient(config, fakeFetch(files)));

test("`site-mcp list_posts` prints the verified feed", async () => {
  const r = await run(["list_posts"]);
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.stdout).items[0].slug, "hi");
});

test("`site-mcp get_conformance` is verified", async () => {
  const r = await run(["get_conformance"]);
  assert.equal(r.code, 0);
  assert.ok("pages" in JSON.parse(r.stdout));
});

test("`site-mcp get_post hi` parses the positional slug", async () => {
  const r = await run(["get_post", "hi"]);
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.stdout).slug, "hi");
});

test("a tampered feed fails closed (exit 1, empty stdout)", async () => {
  const r = await run(["list_posts"], fixture(true));
  assert.equal(r.code, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /digest mismatch/);
});

test("usage lists the three site commands", async () => {
  const r = await run([]);
  assert.match(r.stdout, /list_posts/);
  assert.match(r.stdout, /get_post/);
  assert.match(r.stdout, /get_conformance/);
});
