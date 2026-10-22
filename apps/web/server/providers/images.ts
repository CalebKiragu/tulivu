import type { AppConfig } from "../config.js";

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  brandName: string;
  brandColors: string[];
  product: string;
  placement: string;
  seed: string;
}

export interface GeneratedImage {
  bytes: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
  providerId: string;
  modelId: string;
  status: "ready" | "mock" | "failed";
  prompt: string;
  metadata: Record<string, unknown>;
}

export interface ImageGenerationProvider {
  id: string;
  modelId: string;
  generate(request: ImageGenerationRequest): Promise<GeneratedImage>;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hashNumber(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Deterministic, clearly-labelled placeholder art. No paid provider required. */
export class MockImageProvider implements ImageGenerationProvider {
  readonly id = "mock";
  readonly modelId = "mock-canvas-1";

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const seed = hashNumber(request.seed);
    const palette = request.brandColors.length >= 2 ? request.brandColors : ["#173D35", "#D9C58D"];
    const dark = palette[0] ?? "#173D35";
    const accent = palette[1] ?? "#D9C58D";
    const rotation = seed % 40;
    const blobs = Array.from({ length: 4 }, (_, index) => {
      const x = 12 + ((seed >> (index * 3)) % 70);
      const y = 10 + ((seed >> (index * 2)) % 75);
      const radius = 8 + ((seed >> (index * 4)) % 24);
      return `<circle cx="${x}%" cy="${y}%" r="${radius}%" fill="${index % 2 === 0 ? accent : dark}" opacity="${0.12 + index * 0.04}" />`;
    }).join("");
    const label = escapeXml(request.brandName);
    const placement = escapeXml(request.placement);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${request.width}" height="${request.height}" viewBox="0 0 ${request.width} ${request.height}" role="img" aria-label="Mock creative placeholder for ${label}">
  <rect width="100%" height="100%" fill="${escapeXml(dark)}" />
  <g transform="rotate(${rotation} ${request.width / 2} ${request.height / 2})">${blobs}</g>
  <rect x="${request.width * 0.08}" y="${request.height * 0.08}" width="${request.width * 0.84}" height="${request.height * 0.84}" fill="none" stroke="${escapeXml(accent)}" stroke-opacity="0.55" stroke-width="2" />
  <text x="50%" y="46%" text-anchor="middle" font-family="Georgia, serif" font-size="${Math.round(request.width * 0.055)}" fill="#F5F1E7">${label}</text>
  <text x="50%" y="53%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(request.width * 0.022)}" letter-spacing="3" fill="${escapeXml(accent)}">MOCK VISUAL · ${placement.toUpperCase()}</text>
  <text x="50%" y="59%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(request.width * 0.018)}" fill="#F5F1E7" opacity="0.75">Replace with a configured image provider</text>
</svg>`;
    return {
      bytes: Buffer.from(svg, "utf8"),
      mimeType: "image/svg+xml",
      width: request.width,
      height: request.height,
      providerId: this.id,
      modelId: this.modelId,
      status: "mock",
      prompt: request.prompt,
      metadata: { simulated: true, seed: request.seed, placement: request.placement },
    };
  }
}

class OpenAICompatibleImageProvider implements ImageGenerationProvider {
  readonly id = "openai-compatible";
  readonly modelId: string;

  constructor(
    private readonly config: AppConfig,
  ) {
    this.modelId = config.image.model;
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const apiKey = this.config.image.apiKey;
    if (!apiKey) throw new Error("Image provider is not configured.");
    const size =
      request.width > request.height ? "1536x1024" : request.height > request.width ? "1024x1536" : "1024x1024";
    const prompt = `${request.prompt}\n\nPlaceholdered brand context: ${request.brandName}. Intended placement: ${request.placement}. Do not render essential advertising text into the image; text is layered separately. Avoid: ${request.negativePrompt ?? "medical claims, guarantees, fake endorsements"}.`;

    const response = await fetch(`${this.config.image.baseUrl.replace(/\/+$/, "")}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: this.config.image.model,
        prompt,
        size,
        n: 1,
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(this.config.image.timeoutMs),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Image provider returned HTTP ${response.status}: ${detail}`);
    }
    const payload = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const base64 = payload.data?.[0]?.b64_json;
    if (!base64) throw new Error("Image provider returned no image data.");
    return {
      bytes: Buffer.from(base64, "base64"),
      mimeType: "image/png",
      width: request.width,
      height: request.height,
      providerId: this.id,
      modelId: this.modelId,
      status: "ready",
      prompt,
      metadata: { size, model: this.modelId },
    };
  }
}

export function createImageProvider(config: AppConfig): ImageGenerationProvider {
  return config.image.provider === "mock"
    ? new MockImageProvider()
    : new OpenAICompatibleImageProvider(config);
}
