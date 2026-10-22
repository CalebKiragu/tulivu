import { z } from "zod";
import { ARTIFACT_TYPES, CHANNELS, CURRENCIES, OBJECTIVES, WORKFLOW_STAGES } from "./constants.js";

type ChannelValue = (typeof CHANNELS)[number]["id"];
type ObjectiveValue = (typeof OBJECTIVES)[number]["id"];
type CurrencyValue = (typeof CURRENCIES)[number]["code"];
type StageValue = (typeof WORKFLOW_STAGES)[number]["name"];

const channelIds = CHANNELS.map((channel) => channel.id) as [ChannelValue, ...ChannelValue[]];
const objectiveIds = OBJECTIVES.map((objective) => objective.id) as [ObjectiveValue, ...ObjectiveValue[]];
const currencyCodes = CURRENCIES.map((currency) => currency.code) as [CurrencyValue, ...CurrencyValue[]];
const stageNames = WORKFLOW_STAGES.map((stage) => stage.name) as [StageValue, ...StageValue[]];

export const channelSchema = z.enum(channelIds);
export const objectiveSchema = z.enum(objectiveIds);
export const currencySchema = z.enum(currencyCodes);
export const stageNameSchema = z.enum(stageNames);
export const artifactTypeSchema = z.enum(ARTIFACT_TYPES);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date");

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour, for example #173D35");

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === "" || /^https?:\/\/[^\s]+$/i.test(value), "Enter a valid http(s) URL");

const boundedText = (max: number) => z.string().trim().max(max);

export const brandProfileSchema = z.object({
  voice: boundedText(400).default(""),
  tone: boundedText(400).default(""),
  colors: z.array(hexColor).max(6).default([]),
  logoUrl: optionalUrl.default(""),
  usps: z.array(boundedText(240)).max(10).default([]),
  competitors: z.array(boundedText(160)).max(10).default([]),
  bannedClaims: z.array(boundedText(240)).max(20).default([]),
  approvedCtas: z.array(boundedText(80)).max(10).default([]),
  existingMaterials: boundedText(2000).default(""),
  goals: boundedText(1000).default(""),
});

export type BrandProfile = z.infer<typeof brandProfileSchema>;

export const businessInputSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(120),
  description: z.string().trim().min(20, "Describe the business in at least 20 characters").max(2000),
  websiteUrl: optionalUrl.default(""),
  industry: z.string().trim().min(2, "Industry is required").max(120),
  country: z.string().trim().min(2, "Country is required").max(120),
  city: boundedText(120).default(""),
  targetCustomers: z.string().trim().min(10, "Describe the target customers").max(1500),
  defaultCurrency: currencySchema.default("KES"),
  socialUrls: z.array(optionalUrl).max(6).default([]),
  brandProfile: brandProfileSchema.default({}),
});

export type BusinessInput = z.infer<typeof businessInputSchema>;

export const businessUpdateSchema = businessInputSchema.partial();

export const campaignBriefInputSchema = z
  .object({
    name: z.string().trim().min(3, "Give the campaign a name").max(140),
    objective: objectiveSchema,
    product: z.string().trim().min(3, "Describe the product or service").max(600),
    geography: z.string().trim().min(2, "Target geography is required").max(180),
    audience: z.string().trim().min(15, "Describe the audience in a little more detail").max(1500),
    channels: z.array(channelSchema).min(1, "Select at least one channel"),
    destinationUrl: optionalUrl.default(""),
    budgetAmount: z.number().positive("Budget must be greater than zero").max(500_000_000),
    budgetCurrency: currencySchema,
    startDate: isoDateSchema,
    durationDays: z.number().int().min(1).max(365),
    conversionAction: z.string().trim().min(2, "Name the primary conversion action").max(240),
    offer: boundedText(400).default(""),
    competitors: boundedText(1500).default(""),
    testimonials: boundedText(2000).default(""),
    brandGuidelines: boundedText(2000).default(""),
    language: boundedText(80).default("English"),
    excludedAudiences: boundedText(1000).default(""),
    instructions: boundedText(2000).default(""),
  })
  .superRefine((brief, ctx) => {
    const needsDestination = ["traffic", "leads", "sales"].includes(brief.objective);
    if (needsDestination && !brief.destinationUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationUrl"],
        message: "This objective needs a destination URL. Tulivu will not invent one.",
      });
    }
    if (new Set(brief.channels).size !== brief.channels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["channels"],
        message: "Each channel can only be selected once.",
      });
    }
  });

export type CampaignBriefInput = z.infer<typeof campaignBriefInputSchema>;

export const campaignCreateSchema = z.object({
  businessId: z.string().uuid(),
  brief: campaignBriefInputSchema,
});

export const campaignUpdateSchema = z.object({
  brief: campaignBriefInputSchema,
});

export type CampaignUpdate = z.infer<typeof campaignUpdateSchema>;

/* ----------------------------------------------------------------------------
 * Artifact content contracts. Every value written to the artifacts table is
 * validated against one of these schemas before it is persisted.
 * -------------------------------------------------------------------------- */

export const copyVariantSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  rationale: z.string().max(400).optional(),
});

export type CopyVariant = z.infer<typeof copyVariantSchema>;

const validationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string(),
  field: z.string().optional(),
});

export const campaignBriefArtifactSchema = z.object({
  name: z.string(),
  objective: objectiveSchema,
  product: z.string(),
  geography: z.string(),
  audience: z.string(),
  channels: z.array(channelSchema),
  destinationUrl: z.string(),
  budget: z.object({ amount: z.number().positive(), currency: currencySchema }),
  startDate: z.string(),
  endDate: z.string(),
  durationDays: z.number().int().positive(),
  conversionAction: z.string(),
  offer: z.string(),
  language: z.string(),
  exclusions: z.string(),
  instructions: z.string(),
  missingInformation: z.array(z.string()),
  assumptions: z.array(z.string()),
  clarifications: z.array(z.object({ field: z.string(), question: z.string() })),
  normalizedAt: z.string(),
});

export type CampaignBriefArtifact = z.infer<typeof campaignBriefArtifactSchema>;

export const marketingStrategySchema = z.object({
  valueProposition: z.string(),
  positioning: z.string(),
  keyMessages: z.array(z.string()),
  cta: z.string(),
  campaignStructure: z.object({
    meta: z.string().optional(),
    google: z.string().optional(),
  }),
  creativeFormats: z.array(z.string()),
  successMetric: z.string(),
  assumptions: z.array(z.string()),
  groundedIn: z.array(z.string()),
});

export type MarketingStrategy = z.infer<typeof marketingStrategySchema>;

export const audienceResearchSchema = z.object({
  mode: z.enum(["hypothesis", "research"]),
  provider: z.string(),
  researchedAt: z.string(),
  summary: z.string(),
  observedFacts: z.array(
    z.object({
      fact: z.string(),
      source: z.string(),
      retrievedAt: z.string(),
    }),
  ),
  hypotheses: z.array(z.string()),
  segments: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      needs: z.array(z.string()),
      objections: z.array(z.string()),
    }),
  ),
  keywordThemes: z.array(z.string()),
  notes: z.string(),
});

export type AudienceResearch = z.infer<typeof audienceResearchSchema>;

export const adCopySchema = z.object({
  meta: z
    .object({
      primaryTexts: z.array(copyVariantSchema),
      headlines: z.array(copyVariantSchema),
      descriptions: z.array(copyVariantSchema),
      ctas: z.array(z.string()),
      concepts: z.array(
        z.object({
          name: z.string(),
          idea: z.string(),
          visualDirection: z.string(),
          placement: z.string(),
        }),
      ),
    })
    .optional(),
  google: z
    .object({
      headlines: z.array(copyVariantSchema),
      descriptions: z.array(copyVariantSchema),
      keywordThemes: z.array(z.string()),
      negativeKeywords: z.array(z.string()),
      sitelinks: z.array(z.string()),
    })
    .optional(),
  validation: z.array(
    z.object({
      channel: channelSchema,
      status: z.enum(["pass", "warning", "error"]),
      issues: z.array(validationIssueSchema),
    }),
  ),
  constraintsVersion: z.string(),
  generatedAt: z.string(),
});

export type AdCopyPackage = z.infer<typeof adCopySchema>;

export const creativeAssetSchema = z.object({
  id: z.string(),
  kind: z.enum(["template", "generated", "copy"]),
  channel: channelSchema,
  placement: z.string(),
  format: z.enum(["svg", "png", "text"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.string().optional(),
  storageKey: z.string().optional(),
  prompt: z.string().optional(),
  status: z.enum(["ready", "mock", "failed"]),
  provider: z.string(),
  headline: z.string().optional(),
  subhead: z.string().optional(),
  cta: z.string().optional(),
  copy: z.string().optional(),
  notes: z.array(z.string()).default([]),
  createdAt: z.string(),
});

export type CreativeAsset = z.infer<typeof creativeAssetSchema>;

export const creativePackageSchema = z.object({
  assets: z.array(creativeAssetSchema),
  imageProvider: z.string(),
  notes: z.array(z.string()),
  generatedAt: z.string(),
});

export type CreativePackage = z.infer<typeof creativePackageSchema>;

export const conversionReportSchema = z.object({
  destinationUrl: z.string(),
  syntaxValid: z.boolean(),
  reachable: z.boolean().nullable(),
  httpStatus: z.number().nullable(),
  checkedAt: z.string(),
  checkNote: z.string(),
  issues: z.array(z.object({ severity: z.enum(["info", "warning", "error"]), message: z.string() })),
  recommendations: z.array(z.string()),
  utm: z.array(z.string()),
  measurement: z.object({
    configured: z.boolean(),
    required: z.boolean(),
    note: z.string(),
  }),
});

export type ConversionReadinessReport = z.infer<typeof conversionReportSchema>;

const channelDraftSchema = z.object({
  platform: channelSchema,
  externalPreviewId: z.string(),
  campaignName: z.string(),
  objective: z.string(),
  budget: z.object({
    amount: z.number(),
    currency: currencySchema,
    daily: z.number(),
    allocation: z.number(),
  }),
  schedule: z.object({ start: z.string(), end: z.string() }),
  destinationUrl: z.string(),
  status: z.enum(["draft", "paused", "ready"]),
  structure: z.array(
    z.object({
      level: z.enum(["campaign", "ad_set", "ad_group", "creative", "ad"]),
      name: z.string(),
      details: z.string(),
    }),
  ),
  creativeIds: z.array(z.string()),
});

export const campaignDraftSchema = z.object({
  campaignVersion: z.number().int().positive(),
  platformNeutral: z.object({
    name: z.string(),
    objective: objectiveSchema,
    geography: z.string(),
    audience: z.string(),
    conversionAction: z.string(),
    budget: z.object({ amount: z.number(), currency: currencySchema }),
    schedule: z.object({ start: z.string(), end: z.string() }),
    destinationUrl: z.string(),
    channels: z.array(channelSchema),
  }),
  channels: z.object({
    meta: channelDraftSchema.optional(),
    google: channelDraftSchema.optional(),
  }),
  validation: z.array(
    z.object({
      platform: channelSchema,
      status: z.enum(["pass", "warning", "error"]),
      issues: z.array(validationIssueSchema),
    }),
  ),
  estimatedSpend: z.object({
    amount: z.number(),
    currency: currencySchema,
    note: z.string(),
  }),
  requiredIntegrations: z.array(z.string()),
  previews: z
    .array(
      z.object({
        platform: channelSchema,
        externalPreviewId: z.string(),
        estimatedReach: z.object({ min: z.number(), max: z.number() }).nullable(),
        estimatedDailySpend: z.object({ amount: z.number(), currency: currencySchema }).nullable(),
        notes: z.array(z.string()),
        simulated: z.boolean(),
      }),
    )
    .optional(),
  generatedAt: z.string(),
});

export type CampaignDraft = z.infer<typeof campaignDraftSchema>;

export const qualityReportSchema = z.object({
  campaignVersion: z.number().int().positive(),
  verdict: z.enum(["pass", "warn", "fail"]),
  score: z.number().min(0).max(100),
  checks: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      status: z.enum(["pass", "warn", "fail"]),
      detail: z.string(),
      source: z.enum(["deterministic", "model"]),
    }),
  ),
  suggestions: z.array(z.string()),
  reviewedAt: z.string(),
  modelCritique: z.string().optional(),
  modelCritiqueSkippedReason: z.string().optional(),
});

export type QualityReport = z.infer<typeof qualityReportSchema>;

export const artifactContentSchemas = {
  brief: campaignBriefArtifactSchema,
  strategy: marketingStrategySchema,
  audience: audienceResearchSchema,
  copy: adCopySchema,
  creative: creativePackageSchema,
  conversion: conversionReportSchema,
  draft: campaignDraftSchema,
  quality: qualityReportSchema,
} satisfies Record<(typeof ARTIFACT_TYPES)[number], z.ZodTypeAny>;

export const artifactPatchSchema = z.object({
  content: z.unknown(),
  note: z.string().max(400).optional(),
});

export const approvalRequestSchema = z.object({
  campaignVersion: z.number().int().positive(),
  acknowledgeWarnings: z.boolean().default(false),
  note: z.string().max(500).optional(),
});

export const executeRequestSchema = z.object({
  campaignVersion: z.number().int().positive(),
  mode: z.literal("demo").default("demo"),
});

export const resetDemoSchema = z.object({
  confirmation: z.literal("reset demo workspace"),
});

export const settingsPreferencesSchema = z.object({
  workspaceLabel: z.string().trim().min(1).max(80).optional(),
  defaultCurrency: currencySchema.optional(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type WorkflowStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "awaiting_approval"
  | "cancelled";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface BusinessSummary {
  id: string;
  name: string;
  description: string;
  industry: string;
  country: string;
  city: string;
  websiteUrl: string;
  defaultCurrency: string;
  brandColors: string[];
  campaignCount: number;
  updatedAt: string;
}

export interface CampaignSummary {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  objective: string;
  status: string;
  channels: string[];
  budgetAmount: number;
  budgetCurrency: string;
  startDate: string;
  endDate: string;
  currentVersion: number;
  updatedAt: string;
  artifactCount: number;
  assetCount: number;
  hasActiveApproval: boolean;
  lastRunStatus: string | null;
  lastRunStage: string | null;
}

export interface AuditItem {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  runId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AssetSummary {
  id: string;
  campaignId: string;
  campaignName: string;
  key: string;
  url: string;
  kind: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OverviewResponse {
  workspace: { name: string; createdAt: string; demo: boolean };
  metrics: {
    activeCampaigns: number;
    awaitingApproval: number;
    approvedCampaigns: number;
    simulatedLaunches: number;
    creativeAssets: number;
    failures: number;
    plannedBudgets: Array<{ currency: string; amount: number }>;
  };
  campaigns: CampaignSummary[];
  activity: AuditItem[];
  attention: CampaignSummary[];
  provider: {
    modelProvider: string;
    modelName: string;
    imageProvider: string;
    researchProvider: string;
    demoMode: boolean;
  };
}

export interface CampaignDetail {
  campaign: {
    id: string;
    businessId: string;
    name: string;
    objective: string;
    status: string;
    channels: string[];
    budgetAmount: number;
    budgetCurrency: string;
    startDate: string;
    endDate: string;
    currentVersion: number;
    createdAt: string;
    updatedAt: string;
    brief: CampaignBriefInput;
  };
  business: BusinessInput & { id: string };
  artifacts: Record<string, { id: string; version: number; content: unknown; createdAt: string }>;
  artifactHistory: Array<{
    id: string;
    type: string;
    version: number;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
  runs: Array<{
    id: string;
    status: string;
    currentStage: string | null;
    startedAt: string;
    completedAt: string | null;
    errorSummary: string | null;
    providerId: string;
    modelId: string;
  }>;
  stages: Array<{
    id: string;
    runId: string;
    stageName: string;
    status: string;
    attempt: number;
    startedAt: string | null;
    completedAt: string | null;
    error: { message: string } | null;
  }>;
  approvals: Array<{
    id: string;
    campaignVersion: number;
    status: string;
    approvedAt: string;
    operationType: string;
  }>;
  operations: Array<{
    id: string;
    provider: string;
    operationType: string;
    status: string;
    providerResourceId: string | null;
    requestSummary: unknown;
    responseSummary: unknown;
    createdAt: string;
  }>;
  qualityStale: boolean;
}
