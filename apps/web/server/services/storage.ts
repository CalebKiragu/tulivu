import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StoredAsset {
  key: string;
  sizeBytes: number;
  mimeType: string;
}

export interface AssetStorage {
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<StoredAsset>;
  get(key: string): Promise<{ bytes: Uint8Array; mimeType: string } | null>;
  delete(key: string): Promise<void>;
}

function assertSafeKey(key: string): void {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..") || key.startsWith("/") || key.includes("//")) {
    throw new Error("Unsafe asset key");
  }
}

/**
 * Development storage. Render's default filesystem is ephemeral, so small SVG
 * creatives are also persisted as text in Postgres by the asset service.
 * Binary assets need object storage or a mounted disk for durable deployments.
 */
export class LocalAssetStorage implements AssetStorage {
  constructor(private readonly root: string) {}

  async put(key: string, bytes: Uint8Array, mimeType: string): Promise<StoredAsset> {
    assertSafeKey(key);
    const target = path.join(this.root, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    return { key, sizeBytes: bytes.byteLength, mimeType };
  }

  async get(key: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
    assertSafeKey(key);
    try {
      const bytes = await readFile(path.join(this.root, key));
      const mimeType = key.endsWith(".png")
        ? "image/png"
        : key.endsWith(".jpg") || key.endsWith(".jpeg")
          ? "image/jpeg"
          : key.endsWith(".svg")
            ? "image/svg+xml"
            : "application/octet-stream";
      return { bytes, mimeType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    try {
      await unlink(path.join(this.root, key));
    } catch {
      // Deleting a missing key is idempotent.
    }
  }
}
