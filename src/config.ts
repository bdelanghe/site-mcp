/**
 * Runtime configuration, resolved from environment variables (and overridable
 * for tests). The server is read-only; the only thing worth configuring is the
 * origin it points at and how strictly it enforces the Sigstore signature.
 */

export interface Config {
  /** Origin that serves the static site + API + manifest. No trailing slash. */
  baseUrl: string;
  /** Path of the API surface relative to the site root (manifest-relative). */
  apiPrefix: string;
  /** Path of the signed manifest relative to the site root. */
  manifestPath: string;
  /** Path of the Sigstore bundle for the manifest, relative to the site root. */
  signaturePath: string;
  /**
   * Sigstore verification mode for the manifest itself:
   *   "off"   — only the per-file sha256 (manifest) check runs (default).
   *   "warn"  — attempt signature verification; log to stderr on failure.
   *   "require" — fail hard if the manifest signature cannot be verified.
   */
  signatureMode: "off" | "warn" | "require";
  /** Expected Sigstore certificate identity (SAN) of the signing workflow. */
  expectedSignerIdentity: string;
  /** Expected Sigstore OIDC issuer. */
  expectedSignerIssuer: string;
  /** Per-request fetch timeout in milliseconds. */
  fetchTimeoutMs: number;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const baseUrl = stripTrailingSlash(
    env.SITE_MCP_BASE_URL || "https://robertdelanghe.dev",
  );

  const signatureMode = ((): Config["signatureMode"] => {
    const raw = (env.SITE_MCP_SIGNATURE_MODE || "off").toLowerCase();
    if (raw === "warn" || raw === "require" || raw === "off") return raw;
    return "off";
  })();

  return {
    baseUrl,
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
  };
}
