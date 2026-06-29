/**
 * Site-specific configuration VALUES. The verified-static engine + its `Config`
 * shape live in `@bounded-systems/static-mcp`; this file only resolves
 * robertdelanghe.dev's values from the environment. The server is read-only —
 * the only things worth configuring are the origin and how strictly the Sigstore
 * signature is enforced.
 */
import { withDefaults, type Config } from "@bounded-systems/static-mcp";

export type { Config } from "@bounded-systems/static-mcp";

/** Resolve robertdelanghe.dev's {@link Config} from the environment. */
export function resolveConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const signatureMode = ((): Config["signatureMode"] => {
    const raw = (env.SITE_MCP_SIGNATURE_MODE || "off").toLowerCase();
    if (raw === "warn" || raw === "require" || raw === "off") return raw;
    return "off";
  })();

  return withDefaults({
    baseUrl: env.SITE_MCP_BASE_URL || "https://robertdelanghe.dev",
    apiPrefix: "api/v1",
    manifestPath: "site.sha256",
    signaturePath: "site.sha256.sigstore.json",
    signatureMode,
    expectedSignerIdentity:
      env.SITE_MCP_SIGNER_IDENTITY ||
      "https://github.com/bdelanghe/site/.github/workflows/deploy.yml@refs/heads/main",
    expectedSignerIssuer:
      env.SITE_MCP_SIGNER_ISSUER ||
      "https://token.actions.githubusercontent.com",
    fetchTimeoutMs: Number(env.SITE_MCP_FETCH_TIMEOUT_MS) || 15000,
  });
}
