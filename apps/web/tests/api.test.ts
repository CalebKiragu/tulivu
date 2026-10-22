import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CampaignDetail, CampaignSummary } from "@tulivu/shared";
import { createTestHarness, SessionClient, bodyOf, type TestHarness } from "./helpers/app.js";

let harness: TestHarness;
let client: SessionClient;
let campaignId: string;
let businessId: string;

const validBusiness = {
  name: "Test Atelier",
  description: "A small Nairobi studio making refillable home objects for careful buyers.",
  websiteUrl: "https://example.com",
  industry: "Home goods",
  country: "Kenya",
  city: "Nairobi",
  targetCustomers: "Urban adults who prefer durable, repairable homeware.",
  defaultCurrency: "KES",
  socialUrls: ["https://example.com/social"],
  brandProfile: {
    voice: "Plain and specific.",
    tone: "Calm.",
    colors: ["#173D35", "#D9C58D"],
    logoUrl: "",
    usps: ["Refillable by design"],
    competitors: [],
    bannedClaims: ["best in the world"],
    approvedCtas: ["Shop the collection"],
    existingMaterials: "",
    goals: "",
  },
};

const brief = {
  name: "Refill launch",
  objective: "sales",
  product: "Refillable desk tray",
  geography: "Nairobi, Kenya",
  audience: "Adults aged 25–45 who buy durable home objects online.",
  channels: ["meta"],
  destinationUrl: "https://example.com/tray",
  budgetAmount: 25000,
  budgetCurrency: "KES",
  startDate: "2026-03-01",
  durationDays: 10,
  conversionAction: "Purchase of the desk tray",
  offer: "",
  competitors: "",
  testimonials: "",
  brandGuidelines: "",
  language: "English",
  excludedAudiences: "",
  instructions: "",
};

beforeAll(async () => {
  harness = await createTestHarness();
  client = new SessionClient(harness.app);
});

afterAll(async () => {
  await harness.close();
});

describe("API surface", () => {
  it("reports health without requiring workspace data", async () => {
    const response = await client.get("/api/health");
    expect(response.statusCode).toBe(200);
    const body = bodyOf<{ ok: boolean; service: string; persistence: string }>(response);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("tulivu");
    expect(body.persistence).toBe("pglite");
  });

  it("seeds one isolated demo workspace on first contact", async () => {
    const overview = await client.get("/api/overview");
    expect(overview.statusCode).toBe(200);
    const body = bodyOf<{ workspace: { demo: boolean }; campaigns: CampaignSummary[] }>(overview);
    expect(body.workspace.demo).toBe(true);
    expect(body.campaigns).toHaveLength(1);
    campaignId = body.campaigns[0]!.id;

    const businesses = await client.get("/api/businesses");
    const list = bodyOf<{ businesses: Array<{ id: string; name: string }> }>(businesses);
    expect(list.businesses.some((business) => business.name === "Mkono Skincare")).toBe(true);
    businessId = list.businesses[0]!.id;
  });

  it("publishes non-secret provider configuration and platform specs", async () => {
    const response = await client.get("/api/config");
    expect(response.statusCode).toBe(200);
    const body = bodyOf<{
      config: { modelProvider: string; adapterMode: string };
      channels: unknown[];
      objectives: unknown[];
      platformSpecs: Record<string, { limits: { headlineMax: number } }>;
    }>(response);
    expect(body.config.modelProvider).toBe("mock");
    expect(body.config.adapterMode).toBe("demo");
    expect(body.channels.length).toBeGreaterThan(0);
    expect(body.objectives.length).toBeGreaterThan(0);
    expect(body.platformSpecs.meta?.limits.headlineMax).toBe(40);
  });

  it("validates business input and rejects invalid brand colours", async () => {
    const response = await client.post("/api/businesses", {
      ...validBusiness,
      brandProfile: { ...validBusiness.brandProfile, colors: ["forest"] },
    });
    expect(response.statusCode).toBe(400);
    const body = bodyOf<{ error: { code: string } }>(response);
    expect(body.error.code).toBe("validation_error");
  });

  it("creates and updates a business", async () => {
    const created = await client.post("/api/businesses", validBusiness);
    expect(created.statusCode).toBe(201);
    const body = bodyOf<{ business: { id: string; name: string } }>(created);
    expect(body.business.name).toBe(validBusiness.name);

    const updated = await client.patch(`/api/businesses/${body.business.id}`, { city: "Mombasa" });
    expect(updated.statusCode).toBe(200);
    expect(bodyOf<{ business: { city: string } }>(updated).business.city).toBe("Mombasa");
  });

  it("requires a destination URL for a sales campaign", async () => {
    const response = await client.post("/api/campaigns", {
      businessId,
      brief: { ...brief, destinationUrl: "" },
    });
    expect(response.statusCode).toBe(400);
    const body = bodyOf<{ error: { code: string; details: unknown } }>(response);
    expect(body.error.code).toBe("validation_error");
  });

  it("creates a draft campaign with no artifacts", async () => {
    const response = await client.post("/api/campaigns", { businessId, brief });
    expect(response.statusCode).toBe(201);
    const body = bodyOf<{ campaign: CampaignDetail }>(response);
    expect(body.campaign.campaign.status).toBe("draft");
    expect(body.campaign.campaign.currentVersion).toBe(1);
    expect(Object.keys(body.campaign.artifacts)).toHaveLength(0);
  });

  it("returns a normalised 404 for unknown API routes", async () => {
    const response = await client.get("/api/does-not-exist");
    expect(response.statusCode).toBe(404);
    const body = bodyOf<{ error: { code: string; requestId: string } }>(response);
    expect(body.error.code).toBe("not_found");
    expect(body.error.requestId).toBeTruthy();
  });

  it("updates workspace settings without exposing secrets", async () => {
    const updated = await client.patch("/api/settings", {
      workspaceLabel: "Test workspace",
      defaultCurrency: "USD",
    });
    expect(updated.statusCode).toBe(200);
    const body = bodyOf<{ preferences: { workspaceLabel: string; defaultCurrency: string } }>(updated);
    expect(body.preferences.workspaceLabel).toBe("Test workspace");

    const settings = await client.get("/api/settings");
    const loaded = bodyOf<{ workspace: { name: string }; provider: Record<string, unknown> }>(settings);
    expect(loaded.workspace.name).toBe("Test workspace");
    expect(JSON.stringify(loaded.provider)).not.toMatch(/apiKey|secret/i);
  });

  it("keeps workspaces isolated between sessions", async () => {
    const other = new SessionClient(harness.app);
    const otherOverview = await other.get("/api/overview");
    expect(otherOverview.statusCode).toBe(200);

    const foreignCampaign = await other.get(`/api/campaigns/${campaignId}`);
    expect(foreignCampaign.statusCode).toBe(404);

    const foreignBusiness = await other.get(`/api/businesses/${businessId}`);
    expect(foreignBusiness.statusCode).toBe(404);

    const foreignList = await other.get("/api/businesses");
    const list = bodyOf<{ businesses: Array<{ name: string }> }>(foreignList);
    expect(list.businesses.some((business) => business.name === validBusiness.name)).toBe(false);
  });

  it("resets only the caller's demo workspace", async () => {
    const response = await client.post("/api/demo/reset", { confirmation: "reset demo workspace" });
    expect(response.statusCode).toBe(200);

    const overview = await client.get("/api/overview");
    const body = bodyOf<{ campaigns: CampaignSummary[]; activity: Array<{ eventType: string }> }>(overview);
    expect(body.campaigns).toHaveLength(1);
    expect(body.campaigns[0]!.status).toBe("draft");
    expect(body.activity.some((item) => item.eventType === "workspace.seeded")).toBe(true);

    const other = new SessionClient(harness.app);
    await other.get("/api/overview");
    const otherBusinesses = await other.get("/api/businesses");
    expect(otherBusinesses.statusCode).toBe(200);
  });
});
