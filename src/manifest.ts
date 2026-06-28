/**
 * The signed manifest is the trust anchor.
 *
 * `site.sha256` is an ordinary `sha256sum`-format file: one line per published
 * artifact, `<64-hex-digest>  <site-root-relative-path>`. It covers every file
 * the site serves, including the JSON under `api/v1/`. `site.sha256.sigstore.json`
 * is a Sigstore bundle signing the exact bytes of `site.sha256`.
 *
 * Trust model:
 *   - Hash check (always on): fetch a resource, sha256 the bytes we received,
 *     and require it to equal the manifest entry for that path. A MITM, a stale
 *     CDN edge, or a tampered file changes the bytes → the digest won't match →
 *     we refuse to return it. This makes every MCP response verifiable against
 *     the manifest with no trust in the transport.
 *   - Signature check (optional): verify the Sigstore bundle over `site.sha256`
 *     against the expected GitHub Actions workflow identity. This anchors the
 *     manifest itself to the build that produced it.
 */
import { createHash } from "node:crypto";

export class VerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationError";
  }
}

export type Manifest = Map<string, string>;

const LINE = /^([0-9a-f]{64})[ \t]+\*?(.+?)\s*$/i;

/**
 * Parse `sha256sum` output into a path → lowercase-hex-digest map.
 * Tolerates both text-mode (`  path`) and binary-mode (` *path`) separators.
 */
export function parseManifest(text: string): Manifest {
  const map: Manifest = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = LINE.exec(line);
    if (!m) continue;
    map.set(m[2], m[1].toLowerCase());
  }
  if (map.size === 0) {
    throw new VerificationError("manifest contained no usable entries");
  }
  return map;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface VerifiedBytes {
  path: string;
  expected: string;
  actual: string;
}

/**
 * Assert that `bytes` match the manifest entry for `path`. Throws
 * VerificationError on a missing entry or a digest mismatch.
 */
export function assertMatchesManifest(
  manifest: Manifest,
  path: string,
  bytes: Uint8Array,
): VerifiedBytes {
  const expected = manifest.get(path);
  if (!expected) {
    throw new VerificationError(
      `no manifest entry for "${path}" — it is not a signed artifact of this site`,
    );
  }
  const actual = sha256Hex(bytes);
  if (actual !== expected) {
    throw new VerificationError(
      `digest mismatch for "${path}": manifest=${expected} fetched=${actual} ` +
        `(the bytes returned do not match the signed manifest — refusing to serve)`,
    );
  }
  return { path, expected, actual };
}
