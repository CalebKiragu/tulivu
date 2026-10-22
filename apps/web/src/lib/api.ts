import type {
  ArtifactType,
  AuditItem,
  BusinessInput,
  BusinessSummary,
  CampaignBriefInput,
  CampaignDetail,
  CampaignSummary,
  AssetSummary,
  OverviewResponse,
} from "@tulivu/shared";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code = "request_error", details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function headersFor(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: headersFor(init),
  });

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new ApiClientError(
      body?.error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      body?.error?.code ?? "request_error",
      body?.error?.details,
    );
  }

  if (response.status === 204) return undefined as T;
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return (await response.text()) as T;
  return (await response.json()) as T;
}

function jsonRequest<T>(method: "POST" | "PATCH" | "PUT", path: string, body: unknown): Promise<T> {
  return request<T>(path, { method, body: JSON.stringify(body) });
}

/* -------------------------------------------------------------------------- */
/* Response types                                                             */
/* -------------------------------------------------------------------------- */

export interface PublicConfig {
  demoMode: boolean;
  adapterMode: "demo" | "live";
  modelProvider: string;
  modelName: string;
  modelConfigured: boolean;
  imageProvider: string;
  researchProvider: string;
  taskModels: Record<string, string>;
  workflowMode: string;
  persistence: string;
  dataDir?: string;
}

export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
  locale: string;
}

export interface ChannelOption {
  id: string;
  label: string;
  description: string;
  short: string;
}

export interface ObjectiveOption {
  id: string;
  label: string;
  description: string;
}

export interface StageOption {
  name: string;
  label: string;
  short: string;
  description: string;
}

export interface CopyLimits {
  primaryTextMax: number;
  primaryTextRecommended: number;
  headlineMax: number;
  headlineRecommended: number;
  descriptionMax: number;
  descriptionRecommended: number;
}

export interface PlatformSpec {
  id: string;
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

export interface ConfigResponse {
  config: PublicConfig;
  currencies: CurrencyOption[];
  channels: ChannelOption[];
  objectives: ObjectiveOption[];
  stages: StageOption[];
  platformSpecs: Record<string, PlatformSpec>;
}

export interface BusinessListResponse {
  businesses: BusinessSummary[];
}

export interface BusinessResponse {
  business: (BusinessInput & { id: string }) | null;
}

export interface CampaignListResponse {
  campaigns: CampaignSummary[];
}

export interface CampaignDetailResponse {
  campaign: CampaignDetail;
  qualityStale: boolean;
}

export interface ActivityResponse {
  activity: AuditItem[];
}

export interface AssetsResponse {
  assets: AssetSummary[];
}

export interface OverviewApiResponse extends OverviewResponse {
  provider: PublicConfig;
}

export interface SettingsResponse {
  workspace: { name: string; createdAt: string };
  preferences: Record<string, unknown>;
  provider: PublicConfig;
  platformSpecs: Record<string, PlatformSpec>;
}

export interface PlatformCapability {
  id: string;
  label: string;
  mode: "demo" | "live";
  supportsDraftCreation: boolean;
  supportsPublishing: boolean;
  createsPausedResources: boolean;
  supportsBudgetChange: boolean;
  warnings: string[];
}

export interface PlatformsResponse {
  mode: string;
  capabilities: PlatformCapability[];
}

export interface RunResponse {
  runId: string;
  status: string;
  scope?: string;
}

export interface ApprovalResponse {
  approval: {
    id: string;
    campaignVersion: number;
    status: string;
    approvedAt: string;
    operationHash: string;
  };
  campaignVersion: number;
  campaign: CampaignDetail;
}

export interface ExecutionResponse {
  execution: {
    status: "published_demo" | "already_executed" | "partial_failure";
    campaignVersion: number;
    results: Array<{
      platform: string;
      externalCampaignId: string;
      status: "PAUSED" | "ACTIVE";
      simulated: boolean;
      publishedAt: string;
      warnings: string[];
      responseSummary: Record<string, unknown>;
    }>;
    failures: Array<{ platform: string; message: string; externalCampaignId: string | null }>;
    simulated: true;
    message: string;
  };
  campaign: CampaignDetail;
}

export interface ArtifactPatchResponse {
  artifact: { id: string; version: number; content: unknown };
  campaignVersion: number;
  qualityStale: boolean;
}

/* -------------------------------------------------------------------------- */
/* API surface                                                                */
/* -------------------------------------------------------------------------- */

export const api = {
  config: () => request<ConfigResponse>("/api/config"),
  overview: () => request<OverviewApiResponse>("/api/overview"),

  businesses: () => request<BusinessListResponse>("/api/businesses"),
  business: (businessId: string) => request<BusinessResponse>(`/api/businesses/${businessId}`),
  createBusiness: (input: BusinessInput) => jsonRequest<BusinessResponse>("POST", "/api/businesses", input),
  updateBusiness: (businessId: string, input: Partial<BusinessInput>) =>
    jsonRequest<BusinessResponse>("PATCH", `/api/businesses/${businessId}`, input),

  campaigns: () => request<CampaignListResponse>("/api/campaigns"),
  campaign: (campaignId: string) =>
    request<CampaignDetailResponse>(`/api/campaigns/${campaignId}`),
  createCampaign: (input: { businessId: string; brief: CampaignBriefInput }) =>
    jsonRequest<CampaignDetailResponse>("POST", "/api/campaigns", input),
  updateCampaign: (campaignId: string, brief: CampaignBriefInput) =>
    jsonRequest<CampaignDetailResponse>("PATCH", `/api/campaigns/${campaignId}`, { brief }),

  startRun: (campaignId: string) => jsonRequest<RunResponse>("POST", `/api/campaigns/${campaignId}/runs`, {}),
  cancelRun: (campaignId: string, runId: string) =>
    jsonRequest<{ status: string }>("POST", `/api/campaigns/${campaignId}/runs/${runId}/cancel`, {}),
  resumeRun: (campaignId: string, runId: string) =>
    jsonRequest<RunResponse>("POST", `/api/campaigns/${campaignId}/runs/${runId}/resume`, {}),
  revalidateQuality: (campaignId: string) =>
    jsonRequest<RunResponse>("POST", `/api/campaigns/${campaignId}/quality/revalidate`, {}),

  patchArtifact: (campaignId: string, type: ArtifactType, content: unknown, note?: string) =>
    jsonRequest<ArtifactPatchResponse>("PATCH", `/api/campaigns/${campaignId}/artifacts/${type}`, {
      content,
      ...(note ? { note } : {}),
    }),

  approve: (campaignId: string, input: { campaignVersion: number; acknowledgeWarnings: boolean; note?: string }) =>
    jsonRequest<ApprovalResponse>("POST", `/api/campaigns/${campaignId}/approve`, input),
  execute: (campaignId: string, campaignVersion: number) =>
    jsonRequest<ExecutionResponse>("POST", `/api/campaigns/${campaignId}/execute`, {
      campaignVersion,
      mode: "demo",
    }),

  activity: (options: { limit?: number; campaignId?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", String(options.limit));
    if (options.campaignId) params.set("campaignId", options.campaignId);
    const query = params.toString();
    return request<ActivityResponse>(`/api/activity${query ? `?${query}` : ""}`);
  },
  assets: (campaignId?: string) =>
    request<AssetsResponse>(`/api/assets${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ""}`),

  settings: () => request<SettingsResponse>("/api/settings"),
  updateSettings: (input: { workspaceLabel?: string; defaultCurrency?: string }) =>
    jsonRequest<{ preferences: Record<string, unknown> }>("PATCH", "/api/settings", input),
  resetDemo: () => jsonRequest<{ ok: boolean; message: string }>("POST", "/api/demo/reset", { confirmation: "reset demo workspace" }),

  platforms: () => request<PlatformsResponse>("/api/platforms"),
};

export async function downloadCampaignExport(
  campaignId: string,
  format: "markdown" | "json",
  filenameHint: string,
): Promise<void> {
  const response = await fetch(`/api/campaigns/${campaignId}/export?format=${format}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    let message = "The campaign export could not be generated.";
    try {
      const body = (await response.json()) as ApiErrorBody;
      message = body.error.message;
    } catch {
      // Keep the fallback message.
    }
    throw new ApiClientError(message, response.status, "export_failed");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = filenameHint.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  link.href = url;
  link.download = `${safeName || "campaign"}.${format === "json" ? "json" : "md"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
