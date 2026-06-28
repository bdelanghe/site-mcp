/**
 * Optional Sigstore verification of the manifest bytes against the bundle in
 * `site.sha256.sigstore.json`. This is best-effort and dynamically imported so
 * the core (hash) verification works even when `sigstore` is not installed
 * (it is an optionalDependency) or when offline TUF refresh is unavailable.
 *
 * When enabled it asserts the bundle's certificate identity (SAN) and OIDC
 * issuer match the expected GitHub Actions deploy workflow — anchoring the
 * manifest to the build that produced it.
 */
import type { Config } from "./config.js";

export interface SignatureResult {
  verified: boolean;
  reason?: string;
}

export async function verifyManifestSignature(
  manifestBytes: Uint8Array,
  bundleJsonText: string,
  config: Config,
): Promise<SignatureResult> {
  if (config.signatureMode === "off") {
    return { verified: false, reason: "signature verification disabled" };
  }

  let sigstore: any;
  try {
    sigstore = await import("sigstore");
  } catch {
    const reason = "the optional `sigstore` package is not installed";
    if (config.signatureMode === "require") {
      throw new Error(`cannot verify manifest signature: ${reason}`);
    }
    return { verified: false, reason };
  }

  try {
    const bundle = JSON.parse(bundleJsonText);
    await sigstore.verify(bundle, Buffer.from(manifestBytes), {
      certificateIdentityURI: config.expectedSignerIdentity,
      certificateOIDCIssuer: config.expectedSignerIssuer,
    });
    return { verified: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (config.signatureMode === "require") {
      throw new Error(`manifest signature verification failed: ${reason}`);
    }
    return { verified: false, reason };
  }
}
