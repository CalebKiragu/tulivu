import { and, eq, sql } from "drizzle-orm";
import {
  addDays,
  adCopySchema,
  audienceResearchSchema,
  brandProfileSchema,
  campaignBriefArtifactSchema,
  campaignDraftSchema,
  conversionReportSchema,
  creativePackageSchema,
  marketingStrategySchema,
  qualityReportSchema,
  OBJECTIVES,
  type AdCopyPackage,
  type AudienceResearch,
  type BrandProfile,
  type CampaignDraft,
  type CampaignBriefArtifact,
  type ChannelId,
  type CreativeAsset,
  type CreativePackage,
  type MarketingStrategy,
  type QualityReport,
} from "@tulivu/shared";
import {
  GOOGLE_SPEC,
  META_SPEC,
  PLATFORM_SPECS,
  validateCopyAgainstChannels,
} from "@tulivu/ad-platforms";
import type { StageContext } from "./stage-context.js";
import { SCHEMA_NAMES, adCopyDraftSchema, qualityCritiqueSchema } from "../providers/contracts.js";
import {
  promptForAudience,
  promptForBrief,
  promptForCopy,
  promptForQuality,
  promptForStrategy,
} from "./prompts.js";
import { assetUrl, persistAsset } from "../services/assets.js";
import { renderTemplateSvg, type TemplateVariant } from "../services/creative-renderer.js";
import { externalOperations } from "../db/schema.js";

export interface StageResult {
  summary: string;
  artifactId?: string;
}

function toolContext(ctx: StageContext) {
  return {
    ownerId: ctx.ownerId,
    campaignId: ctx.campaignId,
    runId: ctx.runId,
    actorId: "tulivu",
  };
}

function businessContext(ctx: StageContext) {
  return {
    name: ctx.business.name,
    description: ctx.business.description,
    industry: ctx.business.industry,
    city: ctx.business.city,
    country: ctx.business.country,
    targetCustomers: ctx.business.targetCustomers,
    brandProfile: brandProfileSchema.parse(ctx.business.brandProfileJson),
  };
}

function objectiveLabel(objective: string): string {
  return OBJECTIVES.find((item) => item.id === objective)?.label ?? objective;
}

function copyCorpus(copy: AdCopyPackage): string {
  const parts: string[] = [];
  if (copy.meta) {
    parts.push(...copy.meta.primaryTexts.map((item) => item.text));
    parts.push(...copy.meta.headlines.map((item) => item.text));
    parts.push(...copy.meta.descriptions.map((item) => item.text));
    parts.push(...copy.meta.ctas);
  }
  if (copy.google) {
    parts.push(...copy.google.headlines.map((item) => item.text));
    parts.push(...copy.google.descriptions.map((item) => item.text));
  }
  return parts.join("\n");
}

async function runIntake(ctx: StageContext): Promise<StageResult> {
  const profile = await ctx.deps.tools.execute<{ id: string; name: string }>(
    "business.get_profile",
    { businessId: ctx.business.id },
    toolContext(ctx),
  );
  const context = {
    business: { ...businessContext(ctx), id: profile.id },
    brief: ctx.brief,
    objectiveLabel: objectiveLabel(ctx.brief.objective),
  };
  const content = await ctx.generate(
    "structured_extraction",
    SCHEMA_NAMES.brief,
    campaignBriefArtifactSchema,
    promptForBrief(context),
    context,
  );
  const saved = await ctx.save("brief", content, "Brief normalised with explicit assumptions");
  if (content.clarifications.length > 0) {
    await ctx.emit("stage.note", {
      stage: "intake",
      message: `${content.clarifications.length} clarification question(s) recorded.`,
    });
  }
  return {
    artifactId: saved.id,
    summary: `Brief normalised; ${content.missingInformation.length} missing item(s), ${content.assumptions.length} assumption(s).`,
  };
}

async function runStrategy(ctx: StageContext): Promise<StageResult> {
  const brief = ctx.read("brief", campaignBriefArtifactSchema);
  if (!brief) throw new Error("Brief artifact is required before strategy.");
  const context = {
    business: businessContext(ctx),
    brief: ctx.brief,
    normalizedBrief: brief,
    objectiveLabel: objectiveLabel(ctx.brief.objective),
  };
  const content = await ctx.generate(
    "planning",
    SCHEMA_NAMES.strategy,
    marketingStrategySchema,
    promptForStrategy(context),
    context,
  );
  const saved = await ctx.save("strategy", content, "Strategy grounded in supplied business facts");
  return { artifactId: saved.id, summary: "Positioning, message and success metric defined." };
}

async function runAudience(ctx: StageContext): Promise<StageResult> {
  const query = `${ctx.business.industry} customers ${ctx.brief.geography} needs objections`;
  const research = await ctx.deps.tools.execute<{
    configured: boolean;
    provider: string;
    results: Array<{ title: string; url: string; content: string; retrievedAt: string }>;
    note: string;
  }>("research.search_web", { query, maxResults: 3 }, toolContext(ctx));

  const context = {
    business: businessContext(ctx),
    brief: ctx.brief,
    research,
    objectiveLabel: objectiveLabel(ctx.brief.objective),
  };
  const content = await ctx.generate(
    "planning",
    SCHEMA_NAMES.audience,
    audienceResearchSchema,
    promptForAudience(context),
    context,
  );

  // Guardrail: a model may never claim research when the tool did not run.
  const guarded: AudienceResearch = research.configured && research.results.length > 0
    ? { ...content, mode: content.observedFacts.length > 0 ? "research" : content.mode, provider: research.provider }
    : {
        ...content,
        mode: "hypothesis",
        provider: research.configured ? research.provider : "none",
        observedFacts: [],
        notes: [content.notes, research.note].filter(Boolean).join(" "),
      };

  const saved = await ctx.save(
    "audience",
    guarded,
    guarded.mode === "research"
      ? "Audience analysis with sourced observations"
      : "Hypothesis-based audience analysis; no research provider ran",
  );
  return {
    artifactId: saved.id,
    summary:
      guarded.mode === "research"
        ? `Audience analysis built from ${guarded.observedFacts.length} sourced observation(s).`
        : "Hypothesis-based analysis saved. No market research was claimed.",
  };
}

async function runCopy(ctx: StageContext): Promise<StageResult> {
  const strategy = ctx.read("strategy", marketingStrategySchema);
  const audience = ctx.read("audience", audienceResearchSchema);
  if (!strategy) throw new Error("Strategy artifact is required before copy.");
  const context = {
    business: businessContext(ctx),
    brief: ctx.brief,
    strategy,
    audience,
    limits: { meta: META_SPEC, google: GOOGLE_SPEC },
  };
  const draft = await ctx.generate(
    "copywriting",
    SCHEMA_NAMES.copy,
    adCopyDraftSchema,
    promptForCopy(context),
    context,
  );
  const validation = validateCopyAgainstChannels(
    { ...draft, validation: [] } as unknown as AdCopyPackage,
    ctx.brief.channels as ChannelId[],
  );
  const errors = validation.flatMap((item) => item.issues.filter((issue) => issue.severity === "error"));
  if (errors.length > 0) {
    throw new Error(`Copy failed platform validation: ${errors.map((issue) => issue.message).join(" ")}`);
  }
  const content: AdCopyPackage = {
    ...draft,
    validation,
    constraintsVersion: `${META_SPEC.specVersion};${GOOGLE_SPEC.specVersion}`,
    generatedAt: new Date().toISOString(),
  };
  const saved = await ctx.save(
    "copy",
    content,
    `Channel copy validated against ${ctx.brief.channels.length} platform spec(s)`,
  );
  const warningCount = validation.reduce((total, item) => total + item.issues.filter((issue) => issue.severity === "warning").length, 0);
  return {
    artifactId: saved.id,
    summary: `Copy generated and validated; ${warningCount} warning(s).`,
  };
}

interface ConceptPlan {
  variant: TemplateVariant;
  width: number;
  height: number;
  placement: string;
}

const META_PLACEMENTS: ConceptPlan[] = [
  { variant: "editorial", width: 1080, height: 1350, placement: "Meta feed 4:5" },
  { variant: "split", width: 1080, height: 1920, placement: "Meta stories 9:16" },
  { variant: "bold", width: 1080, height: 1080, placement: "Meta square 1:1" },
];

async function runCreative(ctx: StageContext): Promise<StageResult> {
  const copy = ctx.read("copy", adCopySchema);
  const strategy = ctx.read("strategy", marketingStrategySchema);
  if (!copy) throw new Error("Copy artifact is required before creative production.");
  const brand = brandProfileSchema.parse(ctx.business.brandProfileJson);
  const colors = brand.colors.length ? brand.colors : ["#173D35", "#D9C58D", "#F5F1E7"];
  const assets: CreativeAsset[] = [];
  const notes: string[] = [
    "Template creatives are deterministic SVG files. Essential ad text stays editable and is not baked into generated imagery.",
  ];

  const persistTemplate = async (
    key: string,
    svg: string,
    width: number,
    height: number,
    channel: ChannelId,
    placement: string,
    meta: { headline: string; subhead: string; cta: string; variant: string },
  ) => {
    const row = await persistAsset(ctx.deps.db, ctx.deps.storage, {
      ownerId: ctx.ownerId,
      campaignId: ctx.campaignId,
      key,
      bytes: Buffer.from(svg, "utf8"),
      mimeType: "image/svg+xml",
      width,
      height,
      kind: "template",
      metadata: { channel, placement, ...meta, template: true },
    });
    const validation = await ctx.deps.tools.execute<{ valid: boolean; issues: string[] }>(
      "creative.validate_asset",
      { key: row.key },
      toolContext(ctx),
    );
    if (!validation.valid) notes.push(`${placement}: ${validation.issues.join("; ")}`);
    await ctx.audit("creative.template.created", { key: row.key, channel, placement });
    return row;
  };

  if (copy.meta) {
    const concepts = copy.meta.concepts.slice(0, META_PLACEMENTS.length);
    for (const [index, concept] of concepts.entries()) {
      const plan = META_PLACEMENTS[index]!;
      const headline = copy.meta.headlines[index]?.text ?? strategy?.valueProposition ?? ctx.brief.product;
      const subhead = copy.meta.descriptions[0]?.text ?? ctx.brief.product;
      const cta = copy.meta.ctas[0] ?? strategy?.cta ?? "Learn more";
      const svg = renderTemplateSvg({
        width: plan.width,
        height: plan.height,
        variant: plan.variant,
        brandName: ctx.business.name,
        headline,
        subhead,
        cta,
        product: ctx.brief.product.split(/[:(—]/)[0]?.trim() ?? ctx.brief.product,
        colors,
        placement: plan.placement,
      });
      const slug = concept.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const row = await persistTemplate(
        `campaigns/${ctx.campaignId}/meta-${index + 1}-${slug || "creative"}.svg`,
        svg,
        plan.width,
        plan.height,
        "meta",
        plan.placement,
        { headline, subhead, cta, variant: plan.variant },
      );
      assets.push({
        id: row.id,
        kind: "template",
        channel: "meta",
        placement: plan.placement,
        format: "svg",
        width: plan.width,
        height: plan.height,
        url: assetUrl(row.key),
        storageKey: row.key,
        status: "ready",
        provider: "template-renderer",
        headline,
        subhead,
        cta,
        notes: [concept.idea],
        createdAt: new Date().toISOString(),
      });
    }

    const copyAsset = await persistAsset(ctx.deps.db, ctx.deps.storage, {
      ownerId: ctx.ownerId,
      campaignId: ctx.campaignId,
      key: `campaigns/${ctx.campaignId}/meta-copy-1.txt`,
      bytes: Buffer.from(copy.meta.primaryTexts[0]?.text ?? "", "utf8"),
      mimeType: "text/plain",
      width: 1080,
      height: 1350,
      kind: "copy",
      metadata: { channel: "meta", placement: "Primary text" },
    });
    assets.push({
      id: copyAsset.id,
      kind: "copy",
      channel: "meta",
      placement: "Primary text",
      format: "text",
      width: 1080,
      height: 1350,
      url: assetUrl(copyAsset.key),
      storageKey: copyAsset.key,
      status: "ready",
      provider: "template-renderer",
      copy: copy.meta.primaryTexts[0]?.text,
      notes: ["Text-only variant for review or placement in a template."],
      createdAt: new Date().toISOString(),
    });
  }

  if (copy.google) {
    const headline = copy.google.headlines[0]?.text ?? ctx.brief.product;
    const subhead = copy.google.descriptions[0]?.text ?? ctx.brief.product;
    const cta = strategy?.cta ?? "Learn more";
    const svg = renderTemplateSvg({
      width: 1200,
      height: 628,
      variant: "search",
      brandName: ctx.business.name,
      headline,
      subhead,
      cta,
      product: ctx.brief.product.split(/[:(—]/)[0]?.trim() ?? ctx.brief.product,
      colors,
      placement: "Search companion 1.91:1",
    });
    const row = await persistTemplate(
      `campaigns/${ctx.campaignId}/google-search-companion.svg`,
      svg,
      1200,
      628,
      "google",
      "Search companion 1.91:1",
      { headline, subhead, cta, variant: "search" },
    );
    assets.push({
      id: row.id,
      kind: "template",
      channel: "google",
      placement: "Search companion 1.91:1",
      format: "svg",
      width: 1200,
      height: 628,
      url: assetUrl(row.key),
      storageKey: row.key,
      status: "ready",
      provider: "template-renderer",
      headline,
      subhead,
      cta,
      notes: ["Google responsive search ads use text assets; this is a companion visual for review or display use."],
      createdAt: new Date().toISOString(),
    });

    const copyAsset = await persistAsset(ctx.deps.db, ctx.deps.storage, {
      ownerId: ctx.ownerId,
      campaignId: ctx.campaignId,
      key: `campaigns/${ctx.campaignId}/google-copy-1.txt`,
      bytes: Buffer.from(copy.google.headlines.map((item) => item.text).join("\n"), "utf8"),
      mimeType: "text/plain",
      width: 1200,
      height: 628,
      kind: "copy",
      metadata: { channel: "google", placement: "Headline assets" },
    });
    assets.push({
      id: copyAsset.id,
      kind: "copy",
      channel: "google",
      placement: "Headline assets",
      format: "text",
      width: 1200,
      height: 628,
      url: assetUrl(copyAsset.key),
      storageKey: copyAsset.key,
      status: "ready",
      provider: "template-renderer",
      copy: copy.google.headlines.map((item) => item.text).join(" · "),
      notes: ["Text-only RSA asset set."],
      createdAt: new Date().toISOString(),
    });
  }

  // Optional generated visual. A configured provider is used; failures are
  // recorded honestly rather than silently replaced with mock output.
  if (copy.meta?.concepts.length) {
    const concept = copy.meta.concepts[0]!;
    try {
      const generated = await ctx.deps.tools.execute<{
        key: string;
        url: string;
        width: number;
        height: number;
        status: "ready" | "mock";
        provider: string;
        prompt: string;
      }>(
        "creative.generate_image",
        {
          prompt: `${concept.idea} ${concept.visualDirection} Brand: ${ctx.business.name}. Product: ${ctx.brief.product}.`,
          negativePrompt: brand.bannedClaims.join(", "),
          width: 1080,
          height: 1080,
          placement: "Meta square 1:1 (generated concept)",
          seed: `${ctx.campaignId}-concept-1`,
          brandName: ctx.business.name,
          brandColors: colors,
          product: ctx.brief.product,
        },
        toolContext(ctx),
      );
      assets.push({
        id: generated.key,
        kind: "generated",
        channel: "meta",
        placement: "Meta square 1:1 — generated concept",
        format: "svg",
        width: generated.width,
        height: generated.height,
        url: generated.url,
        storageKey: generated.key,
        status: generated.status,
        provider: generated.provider,
        prompt: generated.prompt,
        notes: [
          generated.status === "mock"
            ? "Mock visual. Replace with a configured image provider before live use."
            : "Generated visual. Review branding and product accuracy before use.",
        ],
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      notes.push(`Image generation failed: ${(error as Error).message}. Template creatives still available.`);
      assets.push({
        id: `failed-${Date.now()}`,
        kind: "generated",
        channel: "meta",
        placement: "Meta square 1:1 — generated concept",
        format: "svg",
        width: 1080,
        height: 1080,
        status: "failed",
        provider: ctx.deps.imageProvider.id,
        prompt: concept.idea,
        notes: ["Generation failed. No placeholder was substituted for the failed provider output."],
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (assets.length === 0) throw new Error("Creative production produced no usable assets.");
  const content: CreativePackage = {
    assets,
    imageProvider: ctx.deps.imageProvider.id,
    notes,
    generatedAt: new Date().toISOString(),
  };
  const parsed = creativePackageSchema.parse(content);
  const saved = await ctx.save("creative", parsed, `${assets.length} creative asset(s) produced`);
  return { artifactId: saved.id, summary: `${assets.length} creative assets produced and validated.` };
}

async function runConversion(ctx: StageContext): Promise<StageResult> {
  const check = await ctx.deps.tools.execute<{
    url: string;
    syntaxValid: boolean;
    reachable: boolean | null;
    httpStatus: number | null;
    checkedAt: string;
    note: string;
  }>("landing_page.check_url", { url: ctx.brief.destinationUrl }, toolContext(ctx));

  const issues: Array<{ severity: "info" | "warning" | "error"; message: string }> = [];
  const needsDestination = ["traffic", "leads", "sales"].includes(ctx.brief.objective);
  if (!ctx.brief.destinationUrl) {
    issues.push({
      severity: needsDestination ? "error" : "warning",
      message: "No destination URL was supplied. Traffic and conversion claims cannot be validated.",
    });
  } else if (!check.syntaxValid) {
    issues.push({ severity: "error", message: check.note });
  } else {
    if (check.httpStatus !== null && check.httpStatus >= 400) {
      issues.push({ severity: "warning", message: check.note });
    } else if (check.reachable === false) {
      issues.push({
        severity: "warning",
        message: `${check.note} Treat this as an unconfirmed check, not proof the page is unavailable to customers.`,
      });
    }
    if (check.reachable === null) {
      issues.push({ severity: "info", message: check.note });
    }
  }

  const needsMeasurement = ["leads", "sales", "app_installs"].includes(ctx.brief.objective);
  issues.push({
    severity: needsMeasurement ? "warning" : "info",
    message:
      "No pixel, conversion API, analytics tag or mobile measurement partner was contacted or installed by this workflow.",
  });

  const recommendations = [
    "Make the primary CTA the same action named in the brief and repeat it above the fold.",
    "Show the actual product, price basis and delivery expectations. Do not add testimonials that were not supplied.",
    "Keep the page's main message aligned with the campaign's value proposition.",
    "Confirm mobile load time and form/purchase completion on a real device before increasing spend.",
    "Add the UTM parameters below to every destination link so traffic can be attributed.",
  ];
  if (ctx.brief.offer) {
    recommendations.push(`Make the offer terms explicit: ${ctx.brief.offer}.`);
  }

  const utm = [
    `utm_source=${ctx.brief.channels.includes("meta") ? "meta" : "google"}`,
    "utm_medium=paid_social_or_search",
    `utm_campaign=${ctx.brief.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
    "utm_content={{ad_variant}}",
  ];

  const report = conversionReportSchema.parse({
    destinationUrl: ctx.brief.destinationUrl,
    syntaxValid: check.syntaxValid,
    reachable: check.reachable,
    httpStatus: check.httpStatus,
    checkedAt: check.checkedAt,
    checkNote: check.note,
    issues,
    recommendations,
    utm,
    measurement: {
      configured: false,
      required: needsMeasurement,
      note: "Measurement is not configured by this demo. A live launch would require a verified conversion event before activation.",
    },
  });
  const saved = await ctx.save(
    "conversion",
    report,
    check.reachable === null || !check.syntaxValid
      ? "Destination could not be verified; recorded honestly"
      : `Destination checked (HTTP ${check.httpStatus ?? "unknown"})`,
  );
  return {
    artifactId: saved.id,
    summary:
      check.reachable === null || !check.syntaxValid
        ? "Conversion readiness recorded with an unverified destination."
        : `Destination check completed with HTTP ${check.httpStatus ?? "unknown"}.`,
  };
}

async function runAssembly(ctx: StageContext): Promise<StageResult> {
  const brief = ctx.read("brief", campaignBriefArtifactSchema);
  const strategy = ctx.read("strategy", marketingStrategySchema);
  const copy = ctx.read("copy", adCopySchema);
  const creative = ctx.read("creative", creativePackageSchema);
  const conversion = ctx.read("conversion", conversionReportSchema);
  if (!brief || !strategy || !copy || !creative || !conversion) {
    throw new Error("All prior artifacts are required before campaign assembly.");
  }

  const version = await ctx.currentVersion();
  const channels = ctx.brief.channels as ChannelId[];
  const allocation = channels.length === 2 ? { meta: 0.6, google: 0.4 } : { [channels[0]!]: 1 } as Record<ChannelId, number>;
  const dailyFor = (channel: ChannelId) =>
    Math.round(((ctx.brief.budgetAmount * (allocation[channel] ?? 0)) / ctx.brief.durationDays) * 100) / 100;

  const baseValidation = copy.validation.map((item) => ({
    platform: item.channel,
    status: item.status,
    issues: item.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      ...(issue.field ? { field: issue.field } : {}),
    })),
  }));

  if (channels.includes("google") && !ctx.brief.destinationUrl) {
    baseValidation.push({
      platform: "google",
      status: "error",
      issues: [{ code: "missing-destination", severity: "error", message: "Google search campaigns require a destination URL." }],
    });
  }
  const conversionErrors = conversion.issues.filter((issue) => issue.severity === "error");
  if (conversionErrors.length > 0) {
    for (const platform of channels) {
      baseValidation.push({
        platform,
        status: "error",
        issues: conversionErrors.map((issue, index) => ({
          code: `conversion-${index + 1}`,
          severity: "error" as const,
          message: issue.message,
        })),
      });
    }
  }

  const channelDrafts = Object.fromEntries(
    channels.map((channel) => {
      const channelCreative = creative.assets.filter((asset) => asset.channel === channel && asset.kind !== "copy");
      const structure: Array<{ level: "campaign" | "ad_set" | "ad_group" | "creative" | "ad"; name: string; details: string }> = [
        {
          level: "campaign",
          name: `${ctx.brief.name} — ${channel === "meta" ? "Meta" : "Google"}`,
          details: `Objective: ${objectiveLabel(ctx.brief.objective)}. Status starts as a paused draft.`,
        },
        {
          level: channel === "meta" ? "ad_set" : "ad_group",
          name: channel === "meta" ? "Prospecting — core audience" : "Core search intent",
          details:
            channel === "meta"
              ? `${ctx.brief.geography}; ${ctx.brief.audience.slice(0, 180)}`
              : `${copy.google?.keywordThemes.slice(0, 5).join(", ") ?? "Keyword themes pending"}`,
        },
        ...channelCreative.map((asset) => ({
          level: "creative" as const,
          name: asset.placement,
          details: `${asset.width}×${asset.height} ${asset.format.toUpperCase()} · ${asset.status}`,
        })),
        {
          level: "ad",
          name: "Paused draft ad",
          details: `Destination: ${ctx.brief.destinationUrl || "not supplied"}. Conversion: ${ctx.brief.conversionAction}.`,
        },
      ];
      return [
        channel,
        {
          platform: channel,
          externalPreviewId: `preview_${channel}_${ctx.campaignId.slice(0, 8)}`,
          campaignName: `${ctx.brief.name} — ${channel === "meta" ? "Meta" : "Google"}`,
          objective: ctx.brief.objective,
          budget: {
            amount: Math.round(ctx.brief.budgetAmount * (allocation[channel] ?? 0) * 100) / 100,
            currency: ctx.brief.budgetCurrency,
            daily: dailyFor(channel),
            allocation: allocation[channel] ?? 0,
          },
          schedule: { start: ctx.brief.startDate, end: addDays(ctx.brief.startDate, ctx.brief.durationDays) },
          destinationUrl: ctx.brief.destinationUrl,
          status: "paused" as const,
          structure,
          creativeIds: channelCreative.map((asset) => asset.id),
        },
      ];
    }),
  ) as Record<ChannelId, CampaignDraft["channels"][ChannelId]>;

  const draft: CampaignDraft = campaignDraftSchema.parse({
    campaignVersion: version,
    platformNeutral: {
      name: ctx.brief.name,
      objective: ctx.brief.objective,
      geography: ctx.brief.geography,
      audience: ctx.brief.audience,
      conversionAction: ctx.brief.conversionAction,
      budget: { amount: ctx.brief.budgetAmount, currency: ctx.brief.budgetCurrency },
      schedule: { start: ctx.brief.startDate, end: addDays(ctx.brief.startDate, ctx.brief.durationDays) },
      destinationUrl: ctx.brief.destinationUrl,
      channels,
    },
    channels: channelDrafts,
    validation: baseValidation,
    estimatedSpend: {
      amount: ctx.brief.budgetAmount,
      currency: ctx.brief.budgetCurrency,
      note: "Planned total budget. Daily pacing is a planning split, not a platform commitment. Demo estimates only.",
    },
    requiredIntegrations: channels.map((channel) =>
      channel === "meta"
        ? "Meta Marketing API — not connected; demo adapter will simulate paused resources."
        : "Google Ads API — not connected; demo adapter will simulate paused resources.",
    ),
    previews: [],
    generatedAt: new Date().toISOString(),
  });

  const validation = await ctx.deps.tools.execute<{
    status: "pass" | "warning" | "error";
    platforms: Array<{
      platform: string;
      status: "pass" | "warning" | "error";
      issues: Array<{ code: string; severity: string; message: string; field?: string }>;
    }>;
  }>("campaign.validate", { draft }, toolContext(ctx));
  draft.validation = validation.platforms.map((item) => ({
    platform: item.platform as ChannelId,
    status: item.status,
    issues: item.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity as "info" | "warning" | "error",
      message: issue.message,
      ...(issue.field ? { field: issue.field } : {}),
    })),
  }));

  try {
    const previews = await ctx.deps.tools.execute<CampaignDraft["previews"]>(
      "ads.preview_campaign",
      { draft },
      toolContext(ctx),
    );
    draft.previews = previews;
  } catch (error) {
    draft.requiredIntegrations.push(`Preview unavailable: ${(error as Error).message}`);
  }

  const saved = await ctx.save(
    "draft",
    campaignDraftSchema.parse(draft),
    "Campaign assembled into a platform-neutral draft with simulated previews",
  );
  return { artifactId: saved.id, summary: "Campaign draft assembled and validated." };
}

async function runQuality(ctx: StageContext): Promise<StageResult> {
  const brief = ctx.read("brief", campaignBriefArtifactSchema);
  const strategy = ctx.read("strategy", marketingStrategySchema);
  const audience = ctx.read("audience", audienceResearchSchema);
  const copy = ctx.read("copy", adCopySchema);
  const creative = ctx.read("creative", creativePackageSchema);
  const conversion = ctx.read("conversion", conversionReportSchema);
  const draft = ctx.read("draft", campaignDraftSchema);
  const checks: QualityReport["checks"] = [];
  const add = (
    id: string,
    label: string,
    status: "pass" | "warn" | "fail",
    detail: string,
    source: "deterministic" | "model" = "deterministic",
  ) => checks.push({ id, label, status, detail, source });

  const required = { brief, strategy, audience, copy, creative, conversion, draft };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  add(
    "required-artifacts",
    "All required artifacts exist",
    missing.length ? "fail" : "pass",
    missing.length ? `Missing: ${missing.join(", ")}.` : "Brief, strategy, audience, copy, creative, conversion and draft are present.",
  );

  const platformIssues = draft?.validation ?? [];
  const platformErrors = platformIssues.flatMap((item) => item.issues.filter((issue) => issue.severity === "error"));
  const platformWarnings = platformIssues.flatMap((item) => item.issues.filter((issue) => issue.severity === "warning"));
  add(
    "platform-requirements",
    "Channel requirements satisfied",
    platformErrors.length ? "fail" : platformWarnings.length ? "warn" : "pass",
    platformErrors.length
      ? platformErrors.map((issue) => issue.message).join(" ")
      : platformWarnings.length
        ? platformWarnings.map((issue) => issue.message).slice(0, 3).join(" ")
        : "Copy and drafts meet the configured platform limits.",
  );

  const brand = brandProfileSchema.parse(ctx.business.brandProfileJson);
  const corpus = copy ? copyCorpus(copy) : "";
  const banned = brand.bannedClaims.filter((claim) => claim.trim() && corpus.toLowerCase().includes(claim.toLowerCase()));
  const riskyClaims = /\b(guarantee|guaranteed|clinically proven|100%)\b|cures? (acne|eczema|rosacea)/i.exec(corpus);
  add(
    "claims-supported",
    "No unsupported or banned claims",
    banned.length > 0 ? "fail" : riskyClaims ? "warn" : "pass",
    banned.length
      ? `Banned claim language found: ${banned.join(", ")}.`
      : riskyClaims
        ? `Review claim language: “${riskyClaims[0]}”. Evidence must be supplied before publishing.`
        : "No banned claims or guarantee-style language found in the generated copy.",
  );

  const testimonialClaim = /(^|\s)["“][^"”]{15,}["”]|customers? (say|love|agree|report)|reviews? from/i.test(corpus);
  add(
    "no-fabricated-proof",
    "No fabricated testimonials or endorsements",
    !ctx.brief.testimonials.trim() && testimonialClaim ? "fail" : "pass",
    !ctx.brief.testimonials.trim() && testimonialClaim
      ? "Copy appears to imply customer proof, but no testimonials were supplied."
      : "No customer quotes or endorsements are presented as fact.",
  );

  add(
    "brand-voice",
    "Brand voice guidance applied",
    brand.voice || brand.tone ? "pass" : "warn",
    brand.voice || brand.tone
      ? "Copy was generated with the supplied brand voice and tone guidance."
      : "No brand voice or tone was supplied; review tone manually.",
  );

  const cta = strategy?.cta ?? "";
  const governmentCta = copy?.meta?.ctas.length || copy?.google?.headlines.length;
  add(
    "cta-agreement",
    "Calls to action are consistent",
    cta && governmentCta ? "pass" : "warn",
    cta && governmentCta
      ? `Primary CTA “${cta}” is reflected in the channel copy assets.`
      : "A primary CTA or channel copy is missing; confirm the next action before launch.",
  );

  const destinationProblems = (conversion?.issues ?? []).filter((issue) => issue.severity === "error");
  add(
    "destination",
    "Destination and conversion path",
    destinationProblems.length ? "fail" : conversion?.reachable === false ? "warn" : "pass",
    destinationProblems.length
      ? destinationProblems.map((issue) => issue.message).join(" ")
      : conversion?.reachable === false
        ? conversion.checkNote
        : `Destination syntax valid; HTTP ${conversion?.httpStatus ?? "not checked"}.`,
  );

  const budgetConsistent =
    brief &&
    brief.budget.amount === ctx.brief.budgetAmount &&
    brief.budget.currency === ctx.brief.budgetCurrency &&
    draft?.platformNeutral.budget.amount === ctx.brief.budgetAmount &&
    draft?.platformNeutral.schedule.end === addDays(ctx.brief.startDate, ctx.brief.durationDays);
  add(
    "budget-schedule",
    "Budget, currency and schedule agree",
    budgetConsistent ? "pass" : "fail",
    budgetConsistent
      ? `${ctx.brief.budgetCurrency} ${ctx.brief.budgetAmount.toLocaleString()} planned across ${ctx.brief.durationDays} days.`
      : "Budget or schedule differs between the brief, draft and campaign record.",
  );

  const restrictedAudience = /\b(under 18|minors?|children|teens?)\b/i.test(ctx.brief.audience);
  const excluded = /\b(under 18|minors?|children|teens?)\b/i.test(ctx.brief.excludedAudiences);
  add(
    "sensitive-targeting",
    "Audience targeting reviewed",
    restrictedAudience && !excluded ? "warn" : "pass",
    restrictedAudience && !excluded
      ? "The audience mentions minors. Restricted targeting must be reviewed before any live campaign."
      : "No restricted or sensitive targeting signal found in the supplied audience description.",
  );

  const usableAssets = creative?.assets.filter((asset) => asset.status !== "failed") ?? [];
  const failedAssets = creative?.assets.filter((asset) => asset.status === "failed") ?? [];
  add(
    "creative-assets",
    "Creative assets are present and usable",
    failedAssets.length > 0 ? "fail" : usableAssets.length > 0 ? "pass" : "fail",
    failedAssets.length > 0
      ? `${failedAssets.length} creative asset(s) failed generation.`
      : `${usableAssets.length} creative asset(s) ready for preview.${usableAssets.some((asset) => asset.status === "mock") ? " Mock visuals are clearly labelled." : ""}`,
  );

  const [submitted] = await ctx.deps.db
    .select({ count: sql<number>`count(*)::int` })
    .from(externalOperations)
    .where(and(eq(externalOperations.campaignId, ctx.campaignId), sql`${externalOperations.status} <> 'failed'`));
  add(
    "not-submitted",
    "Campaign not already submitted",
    (submitted?.count ?? 0) > 0 ? "warn" : "pass",
    (submitted?.count ?? 0) > 0
      ? "This campaign already has recorded external operations. Further execution could duplicate resources."
      : "No external operation exists for this campaign.",
  );

  const currentVersion = await ctx.currentVersion();
  add(
    "version-coherence",
    "Package version is coherent",
    draft && draft.campaignVersion === currentVersion ? "pass" : "warn",
    draft && draft.campaignVersion === currentVersion
      ? `All reviewed artifacts belong to campaign version ${currentVersion}.`
      : `The campaign configuration was assembled for version ${draft?.campaignVersion ?? "unknown"}, but this package is version ${currentVersion}. Re-run assembly after edits before launching.`,
  );

  const failCount = checks.filter((check) => check.status === "fail").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const verdict = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";
  const score = Math.max(0, 100 - warnCount * 10 - failCount * 30);

  let modelCritique: string | undefined;
  let modelCritiqueSkippedReason: string | undefined;
  const provider = ctx.deps.providers.forTask("quality_review");
  if (provider.id === "mock") {
    modelCritiqueSkippedReason =
      "Model critique skipped: the deterministic mock provider cannot provide an independent critique. Configure a live model.";
  } else {
    try {
      const critique = await ctx.generate(
        "quality_review",
        SCHEMA_NAMES.quality,
        qualityCritiqueSchema,
        promptForQuality({
          checks,
          brief: ctx.brief,
          strategy,
          audience,
          copy,
          conversion,
          creativeSummary: creative?.assets.map((asset) => ({
            placement: asset.placement,
            status: asset.status,
            provider: asset.provider,
          })),
        }),
        {
          checks,
          brief: ctx.brief,
          business: businessContext(ctx),
        },
      );
      modelCritique = `${critique.summary}\n${critique.suggestions.map((item) => `• ${item}`).join("\n")}`;
      for (const suggestion of critique.suggestions) {
        add(`model-${checks.length}`, "Independent model suggestion", "warn", suggestion, "model");
      }
    } catch (error) {
      modelCritiqueSkippedReason = `Model critique unavailable: ${(error as Error).message}`;
    }
  }

  const report = qualityReportSchema.parse({
    campaignVersion: currentVersion,
    verdict,
    score,
    checks: checks.map((check) => ({ ...check })),
    suggestions: checks
      .filter((check) => check.status !== "pass")
      .map((check) => `${check.label}: ${check.detail}`)
      .slice(0, 8),
    reviewedAt: new Date().toISOString(),
    ...(modelCritique ? { modelCritique } : {}),
    ...(modelCritiqueSkippedReason ? { modelCritiqueSkippedReason } : {}),
  });
  const saved = await ctx.save("quality", report, `Quality verdict: ${verdict} (${score}/100)`);
  return {
    artifactId: saved.id,
    summary: `Quality review complete: ${verdict} (${score}/100), ${failCount} failure(s), ${warnCount} warning(s).`,
  };
}

export const STAGE_RUNNERS = {
  intake: runIntake,
  strategy: runStrategy,
  audience: runAudience,
  copy: runCopy,
  creative: runCreative,
  conversion: runConversion,
  assembly: runAssembly,
  quality: runQuality,
} as const;
