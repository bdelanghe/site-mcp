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

## License

MIT — see [LICENSE](./LICENSE). The site data itself is published under CC BY 4.0.
