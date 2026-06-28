/**
 * The verifying API client. Fetches the signed manifest once per process,
 * then serves resources only after their bytes are checked against it.
 */
import type { Config } from "./config.js";
import {
  assertMatchesManifest,
  parseManifest,
  VerificationError,
  type Manifest,
  type VerifiedBytes,
} from "./manifest.js";
import { verifyManifestSignature, type SignatureResult } from "./signature.js";

export { VerificationError } from "./manifest.js";

/** A fetched-and-verified artifact. */
export interface VerifiedArtifact {
  /** Manifest-relative path, e.g. "api/v1/profile.json". */
  path: string;
  /** Absolute URL the bytes came from. */
  url: string;
  /** Raw response body. */
  text: string;
  /** Parsed JSON (artifacts are all JSON). */
  json: unknown;
  /** Hash verification detail. */
  verification: VerifiedBytes;
}

export class ApiClient {
  private manifestCache?: Promise<{
    manifest: Manifest;
    signature: SignatureResult;
  }>;

  constructor(
    private readonly config: Config,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Resolve a manifest-relative path to its absolute URL on the origin. */
  urlFor(path: string): string {
    return `${this.config.baseUrl}/${path}`;
  }

  /** Manifest-relative path for an API endpoint under api/v1. */
  apiPath(file: string): string {
    return `${this.config.apiPrefix}/${file}`;
  }

  private async fetchBytes(url: string): Promise<{ bytes: Uint8Array; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.fetchTimeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: { accept: "application/json, text/plain, */*" },
      });
      if (!res.ok) {
        throw new Error(`GET ${url} → HTTP ${res.status} ${res.statusText}`);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const text = new TextDecoder("utf-8").decode(buf);
      return { bytes: buf, text };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Fetch + cache the signed manifest (and optionally its signature). */
  async getManifest(): Promise<{ manifest: Manifest; signature: SignatureResult }> {
    if (!this.manifestCache) {
      this.manifestCache = (async () => {
        const manifestUrl = this.urlFor(this.config.manifestPath);
        const { bytes, text } = await this.fetchBytes(manifestUrl);
        const manifest = parseManifest(text);

        let signature: SignatureResult = {
          verified: false,
          reason: "signature verification disabled",
        };
        if (this.config.signatureMode !== "off") {
          try {
            const { text: bundleText } = await this.fetchBytes(
              this.urlFor(this.config.signaturePath),
            );
            signature = await verifyManifestSignature(bytes, bundleText, this.config);
          } catch (err) {
            if (this.config.signatureMode === "require") throw err;
            signature = {
              verified: false,
              reason: err instanceof Error ? err.message : String(err),
            };
          }
        }
        return { manifest, signature };
      })().catch((err) => {
        // Don't cache a failed manifest fetch — allow retry on next call.
        this.manifestCache = undefined;
        throw err;
      });
    }
    return this.manifestCache;
  }

  /**
   * Fetch a manifest-relative artifact and verify its bytes against the
   * signed manifest before returning. Throws VerificationError on mismatch.
   */
  async getVerified(path: string): Promise<VerifiedArtifact> {
    const { manifest } = await this.getManifest();
    const url = this.urlFor(path);
    const { bytes, text } = await this.fetchBytes(url);
    const verification = assertMatchesManifest(manifest, path, bytes);

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new VerificationError(
        `verified bytes for "${path}" are not valid JSON: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return { path, url, text, json, verification };
  }
}
