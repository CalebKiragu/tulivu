import type { AdCopyPackage, CampaignDraft, ChannelId } from "@tulivu/shared";
import { channelLabel } from "@tulivu/shared";

export interface CopyLimits {
  primaryTextMax: number;
  primaryTextRecommended: number;
  headlineMax: number;
  headlineRecommended: number;
  descriptionMax: number;
  descriptionRecommended: number;
}

export interface PlatformSpec {
  id: ChannelId;
  name: string;
  specVersion: string;
  effectiveDate: string;
  sourceUrl: string;
  limits: CopyLimits;
  requirements: {
    minHeadlines: number;
    maxHeadlines: number;
    minDescriptions: number;
    maxDescriptions: number;
    minPrimaryTexts: number;
    maxPrimaryTexts: number;
    requiresDestination: boolean;
  };
  notes: string[];
}

/**
 * Character limits are adapter configuration, not prompt lore. They are
 * intentionally versioned so a spec change is a visible code change.
 * Values are checked against public platform documentation before live use.
 */
export const META_SPEC: PlatformSpec = {
  id: "meta",
  name: "Meta Ads",
  specVersion: "meta-copy-spec-2026-01",
  effectiveDate: "2026-01-01",
  sourceUrl: "https://www.facebook.com/business/ads-guide",
  limits: {
    primaryTextMax: 500,
    primaryTextRecommended: 125,
    headlineMax: 40,
    headlineRecommended: 27,
    descriptionMax: 30,
    descriptionRecommended: 27,
  },
  requirements: {
    minHeadlines: 3,
    maxHeadlines: 10,
    minDescriptions: 1,
    maxDescriptions: 5,
    minPrimaryTexts: 2,
    maxPrimaryTexts: 8,
    requiresDestination: false,
  },
  notes: [
    "Meta truncates long primary text in feed placements; the first 125 characters carry the message.",
    "Headline limits vary by placement; 40 characters is a safe planning ceiling.",
  ],
};

export const GOOGLE_SPEC: PlatformSpec = {
  id: "google",
  name: "Google Ads",
  specVersion: "google-rsa-spec-2026-01",
  effectiveDate: "2026-01-01",
  sourceUrl: "https://support.google.com/google-ads/answer/7684791",
  limits: {
    primaryTextMax: 90,
    primaryTextRecommended: 90,
    headlineMax: 30,
    headlineRecommended: 30,
    descriptionMax: 90,
    descriptionRecommended: 90,
  },
  requirements: {
    minHeadlines: 3,
    maxHeadlines: 15,
    minDescriptions: 2,
    maxDescriptions: 4,
    minPrimaryTexts: 0,
    maxPrimaryTexts: 0,
    requiresDestination: true,
  },
  notes: [
    "Responsive search ads need at least 3 headlines and 2 descriptions; 15 and 4 are the maximums.",
    "Assets are combined automatically, so every headline and description must stand alone.",
  ],
};

export const PLATFORM_SPECS: Record<ChannelId, PlatformSpec> = {
  meta: META_SPEC,
  google: GOOGLE_SPEC,
};

export interface CopyIssue {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  field?: string;
}

export interface ChannelCopyValidation {
  channel: ChannelId;
  status: "pass" | "warning" | "error";
  issues: CopyIssue[];
}

function charCount(text: string): number {
  return Array.from(text).length;
}

function aggregate(channel: ChannelId, issues: CopyIssue[]): ChannelCopyValidation {
  const status = issues.some((issue) => issue.severity === "error")
    ? "error"
    : issues.some((issue) => issue.severity === "warning")
      ? "warning"
      : "pass";
  return { channel, status, issues };
}

export function validateChannelCopy(channel: ChannelId, copy: AdCopyPackage): ChannelCopyValidation {
  const spec = PLATFORM_SPECS[channel];
  const issues: CopyIssue[] = [];

  if (channel === "meta") {
    const meta = copy.meta;
    if (!meta) {
      return aggregate(channel, [
        { code: "missing-channel-copy", severity: "error", message: "No Meta copy package was generated." },
      ]);
    }
    if (meta.primaryTexts.length < spec.requirements.minPrimaryTexts) {
      issues.push({
        code: "too-few-primary-texts",
        severity: "error",
        message: `Meta needs at least ${spec.requirements.minPrimaryTexts} primary text variations.`,
        field: "meta.primaryTexts",
      });
    }
    if (meta.primaryTexts.length > spec.requirements.maxPrimaryTexts) {
      issues.push({
        code: "too-many-primary-texts",
        severity: "warning",
        message: `More than ${spec.requirements.maxPrimaryTexts} primary texts is hard to review.`,
        field: "meta.primaryTexts",
      });
    }
    meta.primaryTexts.forEach((variant, index) => {
      const length = charCount(variant.text);
      if (length > spec.limits.primaryTextMax) {
        issues.push({
          code: "primary-text-too-long",
          severity: "error",
          message: `Primary text ${index + 1} is ${length} characters; the limit is ${spec.limits.primaryTextMax}.`,
          field: `meta.primaryTexts.${index}`,
        });
      } else if (length > spec.limits.primaryTextRecommended) {
        issues.push({
          code: "primary-text-truncated",
          severity: "warning",
          message: `Primary text ${index + 1} may be truncated after ${spec.limits.primaryTextRecommended} characters.`,
          field: `meta.primaryTexts.${index}`,
        });
      }
    });
    if (meta.headlines.length < spec.requirements.minHeadlines) {
      issues.push({
        code: "too-few-headlines",
        severity: "error",
        message: `Meta needs at least ${spec.requirements.minHeadlines} headlines.`,
        field: "meta.headlines",
      });
    }
    meta.headlines.forEach((variant, index) => {
      const length = charCount(variant.text);
      if (length > spec.limits.headlineMax) {
        issues.push({
          code: "headline-too-long",
          severity: "error",
          message: `Headline ${index + 1} is ${length} characters; the limit is ${spec.limits.headlineMax}.`,
          field: `meta.headlines.${index}`,
        });
      } else if (length > spec.limits.headlineRecommended) {
        issues.push({
          code: "headline-truncated",
          severity: "warning",
          message: `Headline ${index + 1} may truncate after ${spec.limits.headlineRecommended} characters.`,
          field: `meta.headlines.${index}`,
        });
      }
    });
    meta.descriptions.forEach((variant, index) => {
      const length = charCount(variant.text);
      if (length > spec.limits.descriptionMax) {
        issues.push({
          code: "description-too-long",
          severity: "error",
          message: `Description ${index + 1} is ${length} characters; the limit is ${spec.limits.descriptionMax}.`,
          field: `meta.descriptions.${index}`,
        });
      }
    });
    if (meta.primaryTexts.some((variant) => /guarantee|100%|\bclinically proven\b/i.test(variant.text))) {
      issues.push({
        code: "unsupported-claim-language",
        severity: "warning",
        message: "Copy contains guarantee-style language that needs evidence before publishing.",
        field: "meta.primaryTexts",
      });
    }
    if (meta.headlines.some((variant) => /[!]{2,}|\bFREE\b.{0,20}\bFREE\b/.test(variant.text))) {
      issues.push({
        code: "attention-grabbing-formatting",
        severity: "warning",
        message: "Excessive punctuation or repeated free offers can trigger policy review.",
        field: "meta.headlines",
      });
    }
  }

  if (channel === "google") {
    const google = copy.google;
    if (!google) {
      return aggregate(channel, [
        { code: "missing-channel-copy", severity: "error", message: "No Google copy package was generated." },
      ]);
    }
    if (google.headlines.length < spec.requirements.minHeadlines) {
      issues.push({
        code: "too-few-headlines",
        severity: "error",
        message: `Responsive search ads need at least ${spec.requirements.minHeadlines} headlines.`,
        field: "google.headlines",
      });
    }
    if (google.headlines.length > spec.requirements.maxHeadlines) {
      issues.push({
        code: "too-many-headlines",
        severity: "warning",
        message: `Google allows up to ${spec.requirements.maxHeadlines} headlines.`,
        field: "google.headlines",
      });
    }
    google.headlines.forEach((variant, index) => {
      const length = charCount(variant.text);
      if (length > spec.limits.headlineMax) {
        issues.push({
          code: "headline-too-long",
          severity: "error",
          message: `Headline ${index + 1} is ${length} characters; Google's limit is ${spec.limits.headlineMax}.`,
          field: `google.headlines.${index}`,
        });
      }
    });
    if (google.descriptions.length < spec.requirements.minDescriptions) {
      issues.push({
        code: "too-few-descriptions",
        severity: "error",
        message: `Responsive search ads need at least ${spec.requirements.minDescriptions} descriptions.`,
        field: "google.descriptions",
      });
    }
    if (google.descriptions.length > spec.requirements.maxDescriptions) {
      issues.push({
        code: "too-many-descriptions",
        severity: "warning",
        message: `Google allows up to ${spec.requirements.maxDescriptions} descriptions.`,
        field: "google.descriptions",
      });
    }
    google.descriptions.forEach((variant, index) => {
      const length = charCount(variant.text);
      if (length > spec.limits.descriptionMax) {
        issues.push({
          code: "description-too-long",
          severity: "error",
          message: `Description ${index + 1} is ${length} characters; Google's limit is ${spec.limits.descriptionMax}.`,
          field: `google.descriptions.${index}`,
        });
      }
    });
    if (google.keywordThemes.length === 0) {
      issues.push({
        code: "no-keyword-themes",
        severity: "warning",
        message: "No keyword themes were supplied for the Google search campaign.",
        field: "google.keywordThemes",
      });
    }
    if (google.negativeKeywords.length === 0) {
      issues.push({
        code: "no-negative-keywords",
        severity: "info",
        message: "Consider adding negative keywords to avoid wasted spend.",
        field: "google.negativeKeywords",
      });
    }
  }

  return aggregate(channel, issues);
}

export function validateCopyAgainstChannels(copy: AdCopyPackage, channels: ChannelId[]): ChannelCopyValidation[] {
  return channels.map((channel) => validateChannelCopy(channel, copy));
}

/* -------------------------------------------------------------------------- */
/* Platform adapter contract                                                   */
/* -------------------------------------------------------------------------- */

export interface PlatformCapabilities {
  id: ChannelId;
  label: string;
  mode: "demo" | "live";
  supportsDraftCreation: boolean;
  supportsPublishing: boolean;
  createsPausedResources: boolean;
  supportsBudgetChange: boolean;
  warnings: string[];
}

export interface AdPlatformValidation {
  platform: ChannelId;
  status: "pass" | "warning" | "error";
  issues: CopyIssue[];
}

export interface CampaignPreview {
  platform: ChannelId;
  externalPreviewId: string;
  estimatedReach: { min: number; max: number } | null;
  estimatedDailySpend: { amount: number; currency: string } | null;
  notes: string[];
  simulated: boolean;
}

export interface PlatformDraftResult {
  platform: ChannelId;
  externalCampaignId: string;
  externalAdSetId: string;
  externalCreativeIds: string[];
  externalAdIds: string[];
  status: "PAUSED" | "DRAFT";
  simulated: boolean;
  responseSummary: Record<string, unknown>;
}

export interface PublishResult {
  platform: ChannelId;
  externalCampaignId: string;
  status: "PAUSED" | "ACTIVE";
  simulated: boolean;
  publishedAt: string;
  responseSummary: Record<string, unknown>;
  warnings: string[];
}

export interface ApprovedCampaign {
  campaignId: string;
  campaignVersion: number;
  approvedBy: string;
  operationHash: string;
  draft: CampaignDraft;
  currency: string;
}

export class PlatformNotConfiguredError extends Error {
  constructor(platform: ChannelId) {
    super(
      `${channelLabel(platform)} is not connected in this workspace. Demo mode can simulate the campaign without live credentials.`,
    );
    this.name = "PlatformNotConfiguredError";
  }
}

export interface AdPlatformAdapter {
  getCapabilities(): Promise<PlatformCapabilities[]>;
  validateCampaign(campaign: CampaignDraft): Promise<AdPlatformValidation[]>;
  previewCampaign(campaign: CampaignDraft): Promise<CampaignPreview[]>;
  createDraft(campaign: CampaignDraft): Promise<PlatformDraftResult[]>;
  publishCampaign?(campaign: ApprovedCampaign): Promise<PublishResult[]>;
  getCampaignStatus?(externalId: string): Promise<Record<string, unknown>>;
}

/* -------------------------------------------------------------------------- */
/* Deterministic identifiers                                                   */
/* -------------------------------------------------------------------------- */

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function deterministicId(prefix: string, seed: string): string {
  const first = fnv1a(seed);
  const second = fnv1a(`${seed}:${first}`);
  return `${prefix}_${first}${second}`;
}

/* -------------------------------------------------------------------------- */
/* Demo adapter                                                                */
/* -------------------------------------------------------------------------- */

export interface DemoAdapterOptions {
  failForCampaignName?: RegExp;
  now?: () => Date;
}

export class DemoAdPlatformAdapter implements AdPlatformAdapter {
  readonly options: DemoAdapterOptions;

  constructor(options: DemoAdapterOptions = {}) {
    this.options = options;
  }

  async getCapabilities(): Promise<PlatformCapabilities[]> {
    return [
      {
        id: "meta",
        label: "Meta Ads (demo)",
        mode: "demo",
        supportsDraftCreation: true,
        supportsPublishing: true,
        createsPausedResources: true,
        supportsBudgetChange: false,
        warnings: ["Simulated resources only. No request is sent to Meta."],
      },
      {
        id: "google",
        label: "Google Ads (demo)",
        mode: "demo",
        supportsDraftCreation: true,
        supportsPublishing: true,
        createsPausedResources: true,
        supportsBudgetChange: false,
        warnings: ["Simulated resources only. No request is sent to Google."],
      },
    ];
  }

  async validateCampaign(campaign: CampaignDraft): Promise<AdPlatformValidation[]> {
    return campaign.validation;
  }

  async previewCampaign(campaign: CampaignDraft): Promise<CampaignPreview[]> {
    return campaign.platformNeutral.channels.map((channel) => {
      const channelDraft = campaign.channels[channel];
      return {
        platform: channel,
        externalPreviewId: deterministicId("demo_preview", `${campaign.platformNeutral.name}:${channel}`),
        // The demo deliberately does not invent reach or performance numbers.
        // Planning budget is shown elsewhere from the brief.
        estimatedReach: null,
        estimatedDailySpend: null,
        notes: [
          "Reach, spend and performance are not estimated in demo mode.",
          "No platform request was made to generate this preview.",
        ],
        simulated: true,
      };
    });
  }

  async createDraft(campaign: CampaignDraft): Promise<PlatformDraftResult[]> {
    if (this.options.failForCampaignName?.test(campaign.platformNeutral.name)) {
      throw new Error("Injected demo failure: the platform returned an ambiguous draft response.");
    }
    const seed = `${campaign.platformNeutral.name}:${campaign.campaignVersion}:${campaign.platformNeutral.budget.currency}`;
    return campaign.platformNeutral.channels.map((channel) => {
      const channelDraft = campaign.channels[channel];
      const creativeIds =
        channelDraft?.creativeIds.map((id) => deterministicId("demo_creative", `${seed}:${channel}:${id}`)) ?? [];
      return {
        platform: channel,
        externalCampaignId: deterministicId("demo_campaign", `${seed}:${channel}`),
        externalAdSetId: deterministicId(channel === "meta" ? "demo_adset" : "demo_adgroup", `${seed}:${channel}`),
        externalCreativeIds: creativeIds,
        externalAdIds: creativeIds.map((id) => deterministicId("demo_ad", `${seed}:${id}`)),
        status: "PAUSED" as const,
        simulated: true,
        responseSummary: {
          message: "Simulated draft created. No live platform request was made.",
          status: "PAUSED",
          objective: channelDraft?.objective ?? campaign.platformNeutral.objective,
        },
      };
    });
  }

  async publishCampaign(campaign: ApprovedCampaign): Promise<PublishResult[]> {
    if (this.options.failForCampaignName?.test(campaign.draft.platformNeutral.name)) {
      throw new Error("Injected demo failure while publishing the approved campaign.");
    }
    const now = this.options.now?.() ?? new Date();
    const results: PublishResult[] = [];
    for (const channel of campaign.draft.platformNeutral.channels) {
      const draft = await this.createDraft(campaign.draft);
      const matching = draft.find((item) => item.platform === channel);
      if (!matching) continue;
      results.push({
        platform: channel,
        externalCampaignId: matching.externalCampaignId,
        status: "PAUSED",
        simulated: true,
        publishedAt: now.toISOString(),
        responseSummary: {
          message: "Simulation complete. Campaign would exist as a paused draft.",
          externalAdSetId: matching.externalAdSetId,
          externalAdIds: matching.externalAdIds,
          spend: 0,
          simulated: true,
        },
        warnings: [
          "This is a simulated result. No campaign was created on the advertising platform.",
          "A live integration would create paused resources and require a separate activation step.",
        ],
      });
    }
    return results;
  }

  async getCampaignStatus(externalId: string): Promise<Record<string, unknown>> {
    return {
      externalId,
      status: "PAUSED",
      simulated: true,
      checkedAt: (this.options.now?.() ?? new Date()).toISOString(),
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Future live adapters                                                        */
/* -------------------------------------------------------------------------- */

abstract class UnconfiguredLiveAdapter implements AdPlatformAdapter {
  abstract readonly platform: ChannelId;

  async getCapabilities(): Promise<PlatformCapabilities[]> {
    const spec = PLATFORM_SPECS[this.platform];
    return [
      {
        id: this.platform,
        label: `${spec.name} (not connected)`,
        mode: "live",
        supportsDraftCreation: false,
        supportsPublishing: false,
        createsPausedResources: true,
        supportsBudgetChange: false,
        warnings: [
          "Live credentials are not configured. Complete OAuth, permissions and app review before enabling.",
          "No live requests are made by this adapter.",
        ],
      },
    ];
  }

  async validateCampaign(campaign: CampaignDraft): Promise<AdPlatformValidation[]> {
    return campaign.validation.filter((item) => item.platform === this.platform);
  }

  async previewCampaign(): Promise<CampaignPreview[]> {
    return [];
  }

  async createDraft(): Promise<PlatformDraftResult[]> {
    throw new PlatformNotConfiguredError(this.platform);
  }

  async publishCampaign(): Promise<PublishResult[]> {
    throw new PlatformNotConfiguredError(this.platform);
  }

  async getCampaignStatus(): Promise<Record<string, unknown>> {
    throw new PlatformNotConfiguredError(this.platform);
  }
}

/** Live adapter surface. Requests remain intentionally unimplemented until OAuth is configured. */
export class MetaAdsAdapter extends UnconfiguredLiveAdapter {
  readonly platform = "meta" as const;
}

/** Live adapter surface. Requests remain intentionally unimplemented until OAuth is configured. */
export class GoogleAdsAdapter extends UnconfiguredLiveAdapter {
  readonly platform = "google" as const;
}
