import { describe, expect, it } from "vitest";
import {
  addDays,
  campaignBriefInputSchema,
  stableStringify,
  type AdCopyPackage,
} from "@tulivu/shared";
import { validateChannelCopy } from "@tulivu/ad-platforms";
import { renderTemplateSvg } from "../server/services/creative-renderer.js";
import { checkDestinationUrl } from "../server/services/url-check.js";

function baseCopy(overrides: Partial<AdCopyPackage> = {}): AdCopyPackage {
  return {
    meta: {
      primaryTexts: [
        { id: "p1", text: "A gentle barrier routine for reactive skin." },
        { id: "p2", text: "Fragrance-free, made in small batches in Nairobi." },
      ],
      headlines: [
        { id: "h1", text: "Barrier care, simplified" },
        { id: "h2", text: "For sensitive skin" },
        { id: "h3", text: "Refillable glass" },
      ],
      descriptions: [{ id: "d1", text: "Shop the duo." }],
      ctas: ["Shop now"],
      concepts: [],
    },
    google: {
      headlines: [{ id: "g1", text: "Barrier Repair Duo" }],
      descriptions: [{ id: "g2", text: "A gentle cleanser and moisturiser for sensitive skin." }],
      keywordThemes: ["barrier repair"],
      negativeKeywords: ["cure"],
      sitelinks: ["Shop"],
    },
    validation: [],
    constraintsVersion: "test",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("shared utilities", () => {
  it("sorts keys deterministically for hashing", () => {
    expect(stableStringify({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("campaign brief validation", () => {
  const base = {
    name: "Barrier launch",
    objective: "sales" as const,
    product: "Barrier Repair Duo",
    geography: "Nairobi, Kenya",
    audience: "Adults with sensitive or acne-prone skin who shop online.",
    channels: ["meta" as const],
    budgetAmount: 45000,
    budgetCurrency: "KES" as const,
    startDate: "2026-02-01",
    durationDays: 14,
    conversionAction: "Purchase",
    destinationUrl: "https://example.com/shop",
  };

  it("requires a destination for sales objectives instead of inventing one", () => {
    const result = campaignBriefInputSchema.safeParse({ ...base, destinationUrl: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("destinationUrl"))).toBe(true);
    }
  });

  it("rejects duplicate channels", () => {
    const result = campaignBriefInputSchema.safeParse({ ...base, channels: ["meta", "meta"] });
    expect(result.success).toBe(false);
  });

  it("accepts a complete brief and fills safe defaults", () => {
    const result = campaignBriefInputSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.offer).toBe("");
      expect(result.data.language).toBe("English");
      expect(result.data.durationDays).toBe(14);
    }
  });
});

describe("copy validation against platform limits", () => {
  it("flags headlines over the Meta limit as errors", () => {
    const copy = baseCopy();
    copy.meta!.headlines[0] = { id: "h1", text: "A headline that is definitely far too long for Meta" };
    const result = validateChannelCopy("meta", copy);
    expect(result.status).toBe("error");
    expect(result.issues.some((issue) => issue.code === "headline-too-long")).toBe(true);
  });

  it("warns about guarantee-style language", () => {
    const copy = baseCopy();
    copy.meta!.primaryTexts[0] = { id: "p1", text: "100% guaranteed results for every skin type." };
    const result = validateChannelCopy("meta", copy);
    expect(result.issues.some((issue) => issue.code === "unsupported-claim-language")).toBe(true);
    expect(result.status).toBe("warning");
  });

  it("blocks a channel with no copy package", () => {
    const copy = baseCopy({ google: undefined });
    const result = validateChannelCopy("google", copy);
    expect(result.status).toBe("error");
    expect(result.issues[0]?.code).toBe("missing-channel-copy");
  });
});

describe("SVG template rendering", () => {
  it("escapes user and brand text instead of injecting markup", () => {
    const svg = renderTemplateSvg({
      width: 1080,
      height: 1080,
      variant: "bold",
      brandName: "</text><script>alert(1)</script>",
      headline: "<script>alert('x')</script>",
      subhead: "Safe subhead",
      cta: "Shop",
      product: "Duo",
      colors: ["#173D35", "#D9C58D", "#F5F1E7"],
      placement: "Meta square 1:1",
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg.startsWith("<svg")).toBe(true);
  });
});

describe("destination URL checks", () => {
  it("separates syntax validity from reachability for blocked hosts", async () => {
    const result = await checkDestinationUrl("http://localhost:8787/shop");
    expect(result.syntaxValid).toBe(true);
    expect(result.reachable).toBeNull();
    expect(result.note).toMatch(/unverified/i);
  });

  it("marks malformed and non-http URLs as syntactically invalid", async () => {
    const malformed = await checkDestinationUrl("not a url");
    expect(malformed.syntaxValid).toBe(false);
    expect(malformed.reachable).toBeNull();

    const file = await checkDestinationUrl("file:///etc/passwd");
    expect(file.syntaxValid).toBe(false);
  });

  it("records a missing destination without pretending it was checked", async () => {
    const result = await checkDestinationUrl("");
    expect(result.syntaxValid).toBe(false);
    expect(result.note).toMatch(/No destination URL/);
  });
});
