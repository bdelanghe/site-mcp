# @bdelanghe/site-mcp

A **local, read-only [MCP](https://modelcontextprotocol.io) server** over
[robertdelanghe.dev](https://robertdelanghe.dev)'s **signed static API**.

It exposes the site's identity data — profile, writing, the GitHub corpus, the
résumé credential, the OpenAPI doc — to any MCP client (Claude Desktop, Claude
Code, etc.), and **verifies every response byte-for-byte against the site's
Sigstore-signed `sha256` manifest** before handing it back. If the bytes a
client would receive don't match the signed manifest, the server refuses to
return them.

It runs **locally over stdio** — the client spawns it as a subprocess. There is
no hosted server and no network listener, which preserves the site's
static / no-attack-surface posture.

## What it is / isn't

- **Read-only.** There are no write or mutating tools, by design.
- **Trustless.** Responses are content-addressed and checked against the signed
  manifest; you don't have to trust the transport (or this process) to trust the
  bytes — the digest has to match.
- **Local.** stdio transport only. Nothing is served to the network.

## Install / run

Requires Node ≥ 18.17.

```bash
# Run straight from npm (no install):
npx -y @bdelanghe/site-mcp

# Or from a clone:
npm install
npm run build
npm start
```

On startup it logs to **stderr** (stdout is the MCP channel):

```
site-mcp ready (stdio) → https://robertdelanghe.dev; signature mode=off
```

## MCP client configuration

Add to your client's MCP config (Claude Desktop: `claude_desktop_config.json`;
Claude Code: `.mcp.json` / `claude mcp add`):

```json
{
  "mcpServers": {
    "robertdelanghe": {
      "command": "npx",
      "args": ["-y", "@bdelanghe/site-mcp"],
      "env": {
        "SITE_MCP_SIGNATURE_MODE": "warn"
      }
    }
  }
}
```

## Resources

Each maps to a file under `https://robertdelanghe.dev/api/v1/`:

| Resource URI            | Endpoint                  | Contents |
| ----------------------- | ------------------------- | -------- |
| `site://profile`        | `profile.json`            | Headline, intro, label, links |
| `site://posts`          | `posts.json`              | JSON Feed of writing (post list) |
| `site://post/{slug}`    | `posts/{slug}.json`       | A single post (templated; `list` enumerates from the feed) |
| `site://corpus`         | `corpus.json`             | GitHub corpus: stats + highlights |
| `site://conformance`    | `conformance.json`        | Per-page DOM conformance report |
| `site://resume-vc`      | `resume.vc.json`          | Résumé as a Verifiable Credential |
| `site://openapi`        | `openapi.json`            | The OpenAPI 3.2 document for the API |

## Tools (read-only)

| Tool             | Args            | Returns |
| ---------------- | --------------- | ------- |
| `list_posts`     | —               | The posts feed (slug, title, summary, tags) |
| `get_post`       | `slug: string`  | A single post by slug |
| `get_conformance`| —               | The conformance / accessibility report |

Resource reads and tool results carry a `_meta.verification` block recording the
manifest-relative path, source URL, the verified `sha256`, and the manifest
signature status.

## Verification / trust model

The site publishes a single signed manifest, `https://robertdelanghe.dev/site.sha256`
(ordinary `sha256sum` format — `<digest>  <path>`, one line per published file,
including everything under `api/v1/`), and a Sigstore bundle over it,
`site.sha256.sigstore.json`.

1. **Per-file hash check (always on).** The server fetches `site.sha256` once per
   process, then for every resource it (a) fetches the file, (b) computes the
   SHA-256 of the bytes it received, and (c) requires that digest to equal the
   manifest entry for that path. A tampered file, a stale CDN edge, or a
   man-in-the-middle changes the bytes → the digest won't match → the server
   raises a `VerificationError` instead of returning anything. A path that isn't
   in the manifest is likewise refused (it isn't a signed artifact of the site).

2. **Manifest signature check (optional).** Set `SITE_MCP_SIGNATURE_MODE` to
   `warn` or `require` to also verify the Sigstore bundle over `site.sha256`
   against the expected GitHub Actions deploy identity
   (`…/bdelanghe/site/.github/workflows/deploy.yml@refs/heads/main`, issuer
   `https://token.actions.githubusercontent.com`). This anchors the manifest
   itself to the build that produced it. `warn` logs failures to stderr; `require`
   fails closed. Uses the optional [`sigstore`](https://www.npmjs.com/package/sigstore)
   dependency (it fetches Sigstore's TUF trust root on first use).

## Configuration

All optional environment variables:

| Variable                     | Default | Meaning |
| ---------------------------- | ------- | ------- |
| `SITE_MCP_BASE_URL`          | `https://robertdelanghe.dev` | Origin serving the site + API + manifest |
| `SITE_MCP_SIGNATURE_MODE`    | `off`   | `off` \| `warn` \| `require` |
| `SITE_MCP_SIGNER_IDENTITY`   | deploy workflow SAN | Expected Sigstore certificate identity |
| `SITE_MCP_SIGNER_ISSUER`     | GitHub Actions OIDC | Expected Sigstore OIDC issuer |
| `SITE_MCP_FETCH_TIMEOUT_MS`  | `15000` | Per-request fetch timeout |

## Development

```bash
npm install
npm run build       # tsc → dist/
npm test            # node --test via tsx (manifest + fetch/verify, no network)
npm run typecheck
```

## Publishing

**One tag publishes the same version to three registries, mirrored.** Pushing a
`v*` tag runs [`publish.yml`](./.github/workflows/publish.yml), which fans out to:

| # | Registry | Identifier | Auth |
| - | -------- | ---------- | ---- |
| 1 | **npm** | `@bdelanghe/site-mcp` | trusted publishing (OIDC) + [provenance](https://docs.npmjs.com/generating-provenance-statements) |
| 2 | **JSR** (mirror) | `@bdelanghe/site-mcp` | tokenless OIDC (`npx jsr publish`) |
| 3 | **MCP Registry** | `io.github.bdelanghe/site-mcp` | GitHub-OIDC namespace auth (`mcp-publisher`) |

There are **no long-lived secrets** — every registry authenticates with the
job's short-lived GitHub Actions OIDC token (`id-token: write`). npm needs
npm ≥ 11.5 (the workflow upgrades npm to guarantee this).

> [!IMPORTANT]
> **Versions must stay in sync.** The release version lives in **four** places
> that must all match: `package.json`, `deno.json`, `server.json`, and the
> `v<version>` git tag. The workflow's `verify` job hard-fails the whole release
> on any mismatch, so npm and JSR can never drift apart. The MCP Registry also
> requires `package.json` to carry `"mcpName": "io.github.bdelanghe/site-mcp"`
> (it reads that field off the published npm package to prove ownership).

The MCP Registry job runs **after** the npm job, because the registry verifies
ownership by reading `mcpName` from the freshly-published npm package.

### One-time setup (maintainer) — do these BEFORE the first tag

These three registry-side authorizations only need to happen once. Two of the
three (JSR, MCP Registry) are pure repo-link / OIDC — no tokens are minted.

**(a) npm — Trusted Publisher** (on [npmjs.com](https://www.npmjs.com/))

1. Sign in as an owner of the `@bdelanghe` scope.
2. Open the package page for **`@bdelanghe/site-mcp`** → **Settings** →
   **Trusted Publisher**. For a brand-new package you may need to publish `0.1.0`
   once manually (or create the package), then switch to trusted publishing.
3. Choose **GitHub Actions** and enter:
   - **Organization / user:** `bdelanghe`
   - **Repository:** `site-mcp`
   - **Workflow filename:** `publish.yml`  ← (was `publish-npm.yml`)
   - **Environment:** *(leave blank)*
4. Save. No token is generated or stored anywhere. Ensure the package's
   publishing-access policy allows automation/OIDC (trusted publishers satisfy 2FA).

**(b) JSR — create + link the package** (on [jsr.io](https://jsr.io/))

1. Sign in to jsr.io with GitHub and create the package **`@bdelanghe/site-mcp`**
   under the `@bdelanghe` scope.
2. Open the package's **Settings** tab → under **GitHub Repository** enter
   `bdelanghe/site-mcp` and click **Link**. Linking the repo is what enables
   **tokenless OIDC publishing** from this workflow (same idea as npm's trusted
   publisher). No token is created.

**(c) MCP Registry — nothing to pre-authorize**

The `io.github.bdelanghe/*` namespace is **auto-authorized via GitHub OIDC**:
because this repo lives under `github.com/bdelanghe`, `mcp-publisher login
github-oidc` proves ownership of the namespace from the Actions run itself.
There is **no** registry-side claim/consent/linking step to do in advance — the
first `publish.yml` run authenticates and registers the server on its own.
(Package-ownership of the npm entry is proven separately by the `mcpName` field;
see the note above.)

### Cut a release (the single command)

```bash
# 1. Bump the version in ALL of: package.json, deno.json, server.json
#    (and the package entry in server.json). Commit.
# 2. Tag with the SAME version and push — this is the only command:
git tag v0.1.0 && git push origin v0.1.0
```

That one `v*` tag triggers `publish.yml` → npm + JSR + MCP Registry, all at the
same version. You can also run it from the Actions tab via **workflow_dispatch**
(which reuses the `package.json` version in place of a tag).

### Local dry-runs (verify without publishing)

```bash
npm pack --dry-run                                   # npm tarball contents
npx --yes jsr publish --dry-run --allow-slow-types   # JSR (or: deno publish --dry-run --allow-slow-types)
mcp-publisher validate ./server.json                 # MCP Registry schema check
```

## License

MIT — see [LICENSE](./LICENSE). The site data itself is published under CC BY 4.0.
