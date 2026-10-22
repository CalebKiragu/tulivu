import {
  addDays,
  type AdCopyPackage,
  type AudienceResearch,
  type BrandProfile,
  type CampaignBriefInput,
  type CampaignBriefArtifact,
  type MarketingStrategy,
  type QualityReport,
  type CurrencyCode,
} from "@tulivu/shared";
import { validateCopyAgainstChannels } from "@tulivu/ad-platforms";

export interface MockBusinessContext {
  name: string;
  description: string;
  industry: string;
  city: string;
  country: string;
  targetCustomers: string;
  brandProfile: BrandProfile;
}

export interface MockContext {
  business?: MockBusinessContext;
  brief?: CampaignBriefInput;
  strategy?: MarketingStrategy;
  audience?: AudienceResearch;
  checks?: QualityReport["checks"];
  objectiveLabel?: string;
  now?: string;
}

function fit(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (Array.from(clean).length <= max) return clean;
  const words = clean.split(" ");
  let output = "";
  for (const word of words) {
    const candidate = output ? `${output} ${word}` : word;
    if (Array.from(candidate).length > max) break;
    output = candidate;
  }
  if (!output) return Array.from(clean).slice(0, max).join("").trim();
  return output.replace(/[,.;:—-]$/, "");
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function productName(brief: CampaignBriefInput): string {
  return brief.product.split(/[:(—]/)[0]?.trim() || brief.product;
}

function primaryPlace(brief: CampaignBriefInput): string {
  return brief.geography.split(/[,;]/)[0]?.trim() || brief.geography;
}

function requireContext(context: Record<string, unknown> | undefined, key: keyof MockContext): MockContext {
  if (!context?.[key]) {
    throw new Error(`Mock provider is missing required context: ${key}`);
  }
  return context as MockContext;
}

function chooseCta(brief: CampaignBriefInput, brand: MockBusinessContext, fallback: string): string {
  return brand.brandProfile.approvedCtas[0] ?? fallback;
}

function metaHeadlineCandidates(brief: CampaignBriefInput, brand: MockBusinessContext): string[] {
  const product = productName(brief);
  const place = primaryPlace(brief);
  return [
    `${product}, made gentle`,
    "For skin that reacts fast",
    `Fragrance-free, made in ${brand.country}`,
    "A calmer barrier, daily",
    "Fewer surprises, better days",
    `Free ${place} delivery`,
  ].map((item) => fit(item, 40));
}

export function normalizeBrief(context: Record<string, unknown>): CampaignBriefArtifact {
  const { brief, business } = requireContext(context, "brief") as Required<
    Pick<MockContext, "brief" | "business">
  >;
  const missing: string[] = [];
  const assumptions: string[] = [];

  if (!brief.testimonials.trim()) {
    missing.push("No customer testimonials were supplied. Copy does not quote or imply customers.");
  }
  if (!business.brandProfile.logoUrl) {
    missing.push("No logo file was supplied. Creative uses the business name as a wordmark.");
  }
  if (!brief.offer.trim()) {
    missing.push("No offer or discount was supplied. Copy makes no price or discount claim.");
  }
  if (!brief.competitors.trim() && !business.brandProfile.competitors.length) {
    missing.push("No competitors were supplied for context.");
  }

  assumptions.push(`Language: ${brief.language}.`);
  assumptions.push(
    `Schedule: ${brief.durationDays} days starting ${brief.startDate}. End date is derived, not supplied by the user.`,
  );
  assumptions.push(
    `Budget of ${brief.budgetAmount.toLocaleString()} ${brief.budgetCurrency} is a total campaign budget; daily pacing is a planning split, not a platform commitment.`,
  );
  assumptions.push(
    "No web research was performed at intake. Market claims must come from the supplied business profile or a configured research tool.",
  );

  return {
    name: brief.name,
    objective: brief.objective,
    product: brief.product,
    geography: brief.geography,
    audience: brief.audience,
    channels: brief.channels,
    destinationUrl: brief.destinationUrl,
    budget: { amount: brief.budgetAmount, currency: brief.budgetCurrency as CurrencyCode },
    startDate: brief.startDate,
    endDate: addDays(brief.startDate, brief.durationDays),
    durationDays: brief.durationDays,
    conversionAction: brief.conversionAction,
    offer: brief.offer,
    language: brief.language,
    exclusions: brief.excludedAudiences,
    instructions: brief.instructions,
    missingInformation: missing,
    assumptions,
    clarifications: [],
    normalizedAt: new Date().toISOString(),
  };
}

export function buildStrategy(context: Record<string, unknown>): MarketingStrategy {
  const { brief, business } = requireContext(context, "brief") as Required<
    Pick<MockContext, "brief" | "business">
  >;
  const product = productName(brief);
  const place = primaryPlace(brief);
  const usps = business.brandProfile.usps.length
    ? business.brandProfile.usps
    : ["Small-batch production", "Local delivery"];
  const cta = chooseCta(brief, business, "Shop now");
  const objectiveLabel =
    context.objectiveLabel && typeof context.objectiveLabel === "string" ? context.objectiveLabel : brief.objective;

  const valueProposition = `${product} gives ${brief.audience.split(/[.,]/)[0]?.toLowerCase() ?? "your audience"} a simpler routine built on ${lowerFirst(
    usps[0] ?? "careful formulation",
  )} — without inventing claims the product cannot support.`;

  const keyMessages = [
    `${usps[0] ?? "Thoughtfully made"} — stated plainly, without miracle language.`,
    `${usps[1] ?? `Made for ${place}`} matters to people comparing local options.`,
    `The conversion step is specific: ${lowerFirst(brief.conversionAction)}.`,
  ];

  return {
    valueProposition,
    positioning: `${business.name} is positioned as a calm, locally made choice for ${brief.audience.slice(0, 140)}. The campaign leads with product truth and a clear next step rather than urgency.`,
    keyMessages,
    cta,
    campaignStructure: {
      ...(brief.channels.includes("meta")
        ? {
            meta: `One prospecting campaign with a single ad set for ${place}. Two creative directions: product-led and routine-led.`,
          }
        : {}),
      ...(brief.channels.includes("google")
        ? {
            google: `One search campaign, one ad group built around ${product} intent themes, with the landing page as the only destination.`,
          }
        : {}),
    },
    creativeFormats: brief.channels.flatMap((channel) =>
      channel === "meta"
        ? ["Feed 4:5 (1080×1350)", "Stories 9:16 (1080×1920)", "Square 1:1 (1080×1080)"]
        : ["Responsive search ad assets", "Search companion 1.91:1 (1200×628)"],
    ),
    successMetric:
      brief.objective === "sales"
        ? "Cost per purchase and landing-page conversion rate, with a review threshold on cost per 1,000 impressions."
        : brief.objective === "leads"
          ? "Cost per qualified lead and lead-to-conversation rate."
          : `Progress against the ${objectiveLabel.toLowerCase()} objective, measured with a configured conversion event.`,
    assumptions: [
      "No live audience research was performed; segments are hypotheses drawn from the supplied brief.",
      "Platform pricing, reach and conversion rates are unknown until real delivery data exists.",
      brief.destinationUrl
        ? "The destination URL was supplied by the user; reachability is checked separately in the conversion stage."
        : "No destination URL was supplied; the plan avoids traffic claims.",
    ],
    groundedIn: [
      "Business description and target customers",
      `USP: ${usps[0] ?? "not supplied"}`,
      `Campaign objective: ${objectiveLabel}`,
      `Offer: ${brief.offer || "none supplied"}`,
    ],
  };
}

export function buildAudience(context: Record<string, unknown>): AudienceResearch {
  const { brief, business } = requireContext(context, "brief") as Required<
    Pick<MockContext, "brief" | "business">
  >;
  const product = productName(brief);
  const place = primaryPlace(brief);
  const now = new Date().toISOString();
  const usps = business.brandProfile.usps;

  const segments = [
    {
      name: "Sensitive-skin switchers",
      description: `People in ${place} who have had a reaction to a fragrance-heavy product and are actively simplifying their routine.`,
      needs: ["Fragrance-free options", "Ingredient clarity", "A simple two-step routine"],
      objections: ["Will this irritate my skin too?", "Is a small local brand reliable?", "How long until I see a difference?"],
    },
    {
      name: "Ingredient-aware repeat buyers",
      description: `Existing skincare buyers who compare labels and prefer refillable or locally made products.`,
      needs: ["Refill options", "Consistent formulations", "Local delivery"],
      objections: ["Is it worth switching from a familiar brand?", "Does refillable packaging cost more?"],
    },
    {
      name: "Gift and first-trial buyers",
      description: `Buyers looking for a considered, low-risk first purchase around ${brief.offer || "the core product"}.`,
      needs: ["A clear starter option", "Delivery confidence", "A gentle entry price"],
      objections: ["Which product should I start with?", "What if it does not suit me?"],
    },
  ];

  return {
    mode: "hypothesis",
    provider: "mock",
    researchedAt: now,
    summary: `No web research provider is configured. This is a hypothesis-based analysis for ${place}, built only from the supplied business profile and brief. It is not market research.`,
    observedFacts: [],
    hypotheses: [
      `${brief.audience} are more likely to respond to ingredient clarity than to urgency.`,
      `“${usps[0] ?? "Locally made"}” is likely to be a stronger differentiator than generic “premium” language.`,
      `Search demand may exist around “fragrance-free”, “sensitive skin” and “barrier repair” in ${place}.`,
      "A first-purchase offer may reduce risk, but the offer must be the one the business supplied.",
      "Testimonials are absent, so social proof must not be fabricated; reviews should be collected before scaling.",
    ],
    segments,
    keywordThemes: [
      `${product} ${place}`,
      `fragrance free skincare ${place}`,
      "sensitive skin moisturiser kenya",
      "barrier repair routine",
      "acne prone skincare kenya",
      "refillable skincare",
    ],
    notes: [
      "Observations section is intentionally empty: no permitted research source ran.",
      "Validate these hypotheses with platform keyword tools, customer interviews or first-party data before increasing budget.",
      "Do not treat these segments as observed facts in reporting.",
    ].join(" "),
  };
}

export function buildCopy(context: Record<string, unknown>): AdCopyPackage {
  const { brief, business } = requireContext(context, "brief") as Required<
    Pick<MockContext, "brief" | "business">
  >;
  const product = productName(brief);
  const place = primaryPlace(brief);
  const usps = business.brandProfile.usps;
  const cta = chooseCta(brief, business, brief.objective === "sales" ? "Shop now" : "Learn more");
  const offerSentence = brief.offer ? ` ${sentence(brief.offer)}` : "";
  const uspA = usps[0] ?? "Made with care";
  const uspB = usps[1] ?? `Made for ${place}`;
  const uspC = usps[2] ?? "Small-batch production";

  const meta = brief.channels.includes("meta")
    ? {
        primaryTexts: [
          {
            id: "meta-primary-1",
            text: `${product} is for skin that reacts to everything. ${sentence(uspA)} ${sentence(uspB)}${offerSentence}`,
            rationale: "Leads with the audience's frustration, then two supplied product truths.",
          },
          {
            id: "meta-primary-2",
            text: `A gentler routine does not have to be complicated. Start with ${product} and give your barrier time. ${sentence(uspC)}${offerSentence}`,
            rationale: "Routine-led direction for people who feel overwhelmed by active ingredients.",
          },
          {
            id: "meta-primary-3",
            text: `In ${place}, sensitive skin needs fewer surprises. ${business.name} makes ${product} in small batches. ${sentence(uspA)}${offerSentence}`,
            rationale: "Local relevance without unsupported superiority claims.",
          },
          {
            id: "meta-primary-4",
            text: `New to ${business.name}? ${product} pairs a fragrance-free cleanse with steady moisture. No miracle claims — just a calmer daily habit.${offerSentence}`,
            rationale: "Directly addresses scepticism with a calm, specific promise.",
          },
        ],
        headlines: [
          { id: "meta-headline-1", text: fit(`${product}, made gentle`, 40) },
          { id: "meta-headline-2", text: "For skin that reacts fast" },
          { id: "meta-headline-3", text: fit(`Fragrance-free, made in ${business.country}`, 40) },
          { id: "meta-headline-4", text: "A calmer barrier, daily" },
          { id: "meta-headline-5", text: fit(`Fewer surprises for sensitive skin`, 40) },
          { id: "meta-headline-6", text: fit(`Free ${place} delivery`, 40) },
        ],
        descriptions: [
          { id: "meta-desc-1", text: fit("Fragrance-free daily care", 30) },
          { id: "meta-desc-2", text: fit("Made in small batches", 30) },
          { id: "meta-desc-3", text: fit("Refillable glass packaging", 30) },
        ],
        ctas: [cta, brief.objective === "sales" ? "Shop now" : "Learn more"],
        concepts: [
          {
            name: "The quiet shelf",
            idea: "Product duo on a warm ivory surface with one gold line and generous negative space.",
            visualDirection: "Calm editorial still life. Forest green type, no bold sale stickers.",
            placement: "Meta feed 4:5 — 1080×1350",
          },
          {
            name: "Two steps, no noise",
            idea: "Split frame: cleanser on the left, moisturiser on the right, routine explained in three words.",
            visualDirection: "Clean geometric blocks using the brand palette; essential text stays editable.",
            placement: "Meta stories 9:16 — 1080×1920",
          },
          {
            name: "Ingredient honesty",
            idea: "Close crop of the ingredient card with the fragrance-free claim and CTA.",
            visualDirection: "Documentary-style product detail, soft daylight, no medical imagery.",
            placement: "Meta square 1:1 — 1080×1080",
          },
        ],
      }
    : undefined;

  const google = brief.channels.includes("google")
    ? {
        headlines: [
          { id: "google-headline-1", text: fit(product, 30) },
          { id: "google-headline-2", text: "Fragrance-Free Skincare" },
          { id: "google-headline-3", text: "For Sensitive Skin" },
          { id: "google-headline-4", text: fit(`Made in ${business.country}`, 30) },
          { id: "google-headline-5", text: "Refillable Glass Bottles" },
          { id: "google-headline-6", text: fit(`Free ${place} Delivery`, 30) },
          { id: "google-headline-7", text: "Gentle Daily Moisture" },
          { id: "google-headline-8", text: fit(`Shop ${business.name}`, 30) },
        ],
        descriptions: [
          {
            id: "google-desc-1",
            text: fit(
              `A fragrance-free cleanser and moisturiser for sensitive, acne-prone skin. Made in small batches in ${place}.`,
              90,
            ),
          },
          {
            id: "google-desc-2",
            text: fit(
              `A simple two-step barrier routine with no added fragrance. Refillable glass. ${uspB}.`,
              90,
            ),
          },
          {
            id: "google-desc-3",
            text: fit(`${brief.offer || `Explore ${product}`} Shop ${business.name} today.`, 90),
          },
          {
            id: "google-desc-4",
            text: fit(
              "Sensitive skin deserves fewer surprises. Build a calmer daily routine with a considered two-step set.",
              90,
            ),
          },
        ],
        keywordThemes: [
          "barrier repair moisturiser",
          "fragrance free moisturiser kenya",
          "sensitive skin cleanser nairobi",
          "acne prone skincare kenya",
          "refillable skincare",
          "gentle moisturiser for sensitive skin",
        ],
        negativeKeywords: ["eczema cure", "prescription", "dermatologist near me", "free samples"],
        sitelinks: ["Shop the duo", "Ingredients", "Delivery & refills"],
      }
    : undefined;

  const base = {
    ...(meta ? { meta } : {}),
    ...(google ? { google } : {}),
    generatedAt: new Date().toISOString(),
    constraintsVersion: "platform-specs@2026-01",
  };

  const provisional = { ...base, validation: [] } as unknown as AdCopyPackage;
  const validation = validateCopyAgainstChannels(provisional, brief.channels);
  return { ...base, validation } as AdCopyPackage;
}

export function critiqueQuality(context: Record<string, unknown>): {
  summary: string;
  suggestions: string[];
} {
  const checks = Array.isArray(context.checks) ? (context.checks as QualityReport["checks"]) : [];
  const failing = checks.filter((check) => check.status !== "pass");
  return {
    summary: failing.length
      ? `The package is reviewable, but ${failing.length} check${failing.length === 1 ? "" : "s"} need attention before launch.`
      : "The package passed the deterministic checks. This mock critique adds no external evidence.",
    suggestions: failing.map((check) => `Resolve: ${check.label} — ${check.detail}`).slice(0, 6),
  };
}
