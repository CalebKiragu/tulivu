import { createHash } from "node:crypto";
import { addDays, campaignBriefInputSchema, dateInputValue } from "@tulivu/shared";
import type { Database } from "../db/client.js";
import { businesses, campaigns, userSettings, users } from "../db/schema.js";
import { recordAudit } from "./audit.js";

function deterministicUuid(seed: string): string {
  const bytes = createHash("sha256").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const DEMO_BUSINESS = {
  name: "Mkono Skincare",
  description:
    "Mkono Skincare is a Nairobi-based skincare studio making small-batch barrier repair products for sensitive, acne-prone skin. Every formula is fragrance-free, made in Kenya, and packaged in refillable glass.",
  websiteUrl: "https://mkonoskincare.co.ke",
  industry: "Beauty & personal care",
  country: "Kenya",
  city: "Nairobi",
  defaultCurrency: "KES",
  targetCustomers:
    "Women and men aged 20–38 in urban Kenya with sensitive, reactive or acne-prone skin. They already buy skincare online, read ingredient labels, and want gentle routines without fragrances or harsh actives.",
  socialUrls: ["https://instagram.com/mkonoskincare"],
  brandProfile: {
    voice: "Calm, specific, quietly confident. Speaks like a knowledgeable friend, never a hype machine.",
    tone: "Warm, plain-spoken, evidence-aware. Short sentences. No miracle claims.",
    colors: ["#173D35", "#D9C58D", "#F5F1E7"],
    logoUrl: "",
    usps: [
      "Fragrance-free formulas designed for reactive skin",
      "Made in Nairobi in small batches",
      "Refillable glass packaging",
      "Free delivery within Nairobi on orders over KES 3,000",
    ],
    competitors: ["The Ordinary", "Local apothecary brands", "Dermatology clinic product lines"],
    bannedClaims: [
      "cures acne",
      "clinically proven to eliminate eczema",
      "100% guaranteed results",
      "permanent acne removal",
    ],
    approvedCtas: ["Shop the barrier ritual", "Find your barrier routine", "Get the starter set"],
    existingMaterials: "Product photography and ingredient cards exist. No video assets yet.",
    goals: "Grow first-time orders from Nairobi and Mombasa, then build repeat purchase habits.",
  },
};

const seedBrief = campaignBriefInputSchema.parse({
  name: "Barrier Repair Launch — Nairobi",
  objective: "sales",
  product: "Barrier Repair Duo: a fragrance-free cleanser and moisturiser for sensitive, acne-prone skin",
  geography: "Nairobi and Mombasa, Kenya",
  audience:
    "Women and men aged 20–38 with sensitive or acne-prone skin who already buy skincare online and want a gentle, fragrance-free routine",
  channels: ["meta", "google"],
  destinationUrl: "https://mkonoskincare.co.ke/shop/barrier-repair-duo",
  budgetAmount: 45000,
  budgetCurrency: "KES",
  startDate: dateInputValue(),
  durationDays: 14,
  conversionAction: "Purchase of the Barrier Repair Duo",
  offer: "A free travel-size barrier balm on orders over KES 3,500",
  competitors: "The Ordinary, local apothecary brands, dermatology clinic lines",
  testimonials: "",
  brandGuidelines: "Use the forest green and warm ivory brand palette. Keep essential ad text editable.",
  language: "English with light Swahili warmth",
  excludedAudiences: "People under 18; people seeking medical treatment or an eczema cure",
  instructions:
    "Keep the tone calm and specific. Do not promise to cure acne. Mention refillable packaging once, not in every line.",
});

/**
 * Creates a private demo workspace for a visitor. Ids are deterministic per
 * owner so concurrent first requests cannot create duplicate sample data.
 */
export async function ensureDemoWorkspace(db: Database, ownerId: string): Promise<void> {
  const inserted = await db
    .insert(users)
    .values({
      id: ownerId,
      email: `demo+${ownerId}@demo.tulivu.local`,
      displayName: "Demo workspace",
    })
    .onConflictDoNothing()
    .returning({ id: users.id });

  if (inserted.length === 0) return;

  const businessId = deterministicUuid(`business:${ownerId}:mkono`);
  const campaignId = deterministicUuid(`campaign:${ownerId}:barrier-repair`);
  const today = dateInputValue();

  const createdBusiness = await db
    .insert(businesses)
    .values({
      id: businessId,
      ownerId,
      name: DEMO_BUSINESS.name,
      description: DEMO_BUSINESS.description,
      websiteUrl: DEMO_BUSINESS.websiteUrl,
      industry: DEMO_BUSINESS.industry,
      country: DEMO_BUSINESS.country,
      city: DEMO_BUSINESS.city,
      defaultCurrency: DEMO_BUSINESS.defaultCurrency,
      targetCustomers: DEMO_BUSINESS.targetCustomers,
      socialUrls: DEMO_BUSINESS.socialUrls,
      brandProfileJson: DEMO_BUSINESS.brandProfile,
    })
    .onConflictDoNothing()
    .returning({ id: businesses.id });

  if (createdBusiness.length === 0) return;

  const brief = { ...seedBrief, startDate: today };
  await db
    .insert(campaigns)
    .values({
      id: campaignId,
      businessId,
      ownerId,
      name: brief.name,
      objective: brief.objective,
      status: "draft",
      channelsJson: brief.channels,
      budgetAmount: String(brief.budgetAmount),
      budgetCurrency: brief.budgetCurrency,
      startDate: brief.startDate,
      endDate: addDays(brief.startDate, brief.durationDays),
      briefJson: brief,
      currentVersion: 1,
    })
    .onConflictDoNothing();

  await db
    .insert(userSettings)
    .values({
      ownerId,
      preferencesJson: { workspaceLabel: "Demo workspace", defaultCurrency: brief.budgetCurrency, seededAt: today },
    })
    .onConflictDoNothing();

  await recordAudit(db, {
    ownerId,
    campaignId,
    eventType: "workspace.seeded",
    actorType: "system",
    actorId: "tulivu",
    metadata: {
      business: DEMO_BUSINESS.name,
      campaign: brief.name,
      note: "Sample workspace created. No real advertising accounts are connected.",
    },
  });
}

export function demoCampaignId(ownerId: string): string {
  return deterministicUuid(`campaign:${ownerId}:barrier-repair`);
}

export function demoBusinessId(ownerId: string): string {
  return deterministicUuid(`business:${ownerId}:mkono`);
}
