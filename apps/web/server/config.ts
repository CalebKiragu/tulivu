import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type TaskProfile =
  | "planning"
  | "copywriting"
  | "structured_extraction"
  | "creative_direction"
  | "quality_review"
  | "fast_utility";

export const TASK_PROFILES: TaskProfile[] = [
  "planning",
  "copywriting",
  "structured_extraction",
  "creative_direction",
  "quality_review",
  "fast_utility",
];

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  port: number;
  host: string;
  databaseUrl: string | null;
  dataDir: string;
  assetsDir: string;
  pgliteDir: string;
  sessionSecret: string;
  publicBaseUrl: string | null;
  model: {
    provider: "mock" | "openai-compatible";
    baseUrl: string;
    apiKey: string | null;
    model: string;
    taskModels: Record<TaskProfile, string>;
    timeoutMs: number;
    maxOutputTokens: number;
    temperature: number;
  };
  image: {
    provider: "mock" | "openai-compatible";
    baseUrl: string;
    apiKey: string | null;
    model: string;
    timeoutMs: number;
  };
  research: {
    provider: "mock" | "tavily";
    apiKey: string | null;
    timeoutMs: number;
  };
  adapterMode: "demo" | "live";
  workflowInline: boolean;
  demoFailExecution: boolean;
  rateLimitMax: number;
}

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));

function env(key: string): string | undefined {
  const value = process.env[key];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

function intEnv(key: string, fallback: number): number {
  const value = env(key);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolEnv(key: string, fallback = false): boolean {
  const value = env(key);
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function deriveSessionSecret(): { secret: string; generated: boolean } {
  const configured = env("SESSION_SECRET");
  if (configured) return { secret: configured, generated: false };
  const fallback = createHash("sha256").update("tulivu-local-development-session-secret-v1").digest("hex");
  return { secret: fallback, generated: true };
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const nodeEnv = (env("NODE_ENV") ?? "development") as AppConfig["nodeEnv"];
  const dataDir = path.resolve(repoRoot, env("DATA_DIR") ?? "var");
  const modelProvider = (env("MODEL_PROVIDER") ?? "mock") as AppConfig["model"]["provider"];
  const imageProvider = (env("IMAGE_PROVIDER") ?? "mock") as AppConfig["image"]["provider"];
  const researchProvider = (env("WEB_RESEARCH_PROVIDER") ?? "mock") as AppConfig["research"]["provider"];
  const adapterMode = (env("ADAPTER_MODE") ?? "demo") as AppConfig["adapterMode"];
  const { secret: sessionSecret } = deriveSessionSecret();

  const modelName = env("MODEL_NAME") ?? "mock-tulivu-1";
  const taskModels = Object.fromEntries(
    TASK_PROFILES.map((task) => [
      task,
      env(`MODEL_${task.toUpperCase()}`) ?? modelName,
    ]),
  ) as Record<TaskProfile, string>;

  const config: AppConfig = {
    nodeEnv,
    isProduction: nodeEnv === "production",
    port: intEnv("PORT", 8787),
    host: env("HOST") ?? "0.0.0.0",
    databaseUrl: env("DATABASE_URL") ?? null,
    dataDir,
    assetsDir: path.resolve(repoRoot, env("ASSETS_DIR") ?? path.join(dataDir, "assets")),
    pgliteDir: path.resolve(repoRoot, env("PGLITE_DIR") ?? path.join(dataDir, "pglite")),
    sessionSecret,
    publicBaseUrl: env("PUBLIC_BASE_URL") ?? null,
    model: {
      provider: modelProvider,
      baseUrl: env("MODEL_BASE_URL") ?? "https://api.openai.com/v1",
      apiKey: env("MODEL_API_KEY") ?? null,
      model: modelName,
      taskModels,
      timeoutMs: intEnv("MODEL_TIMEOUT_MS", 45_000),
      maxOutputTokens: intEnv("MODEL_MAX_OUTPUT_TOKENS", 2200),
      temperature: Number(env("MODEL_TEMPERATURE") ?? "0.4"),
    },
    image: {
      provider: imageProvider,
      baseUrl: env("IMAGE_BASE_URL") ?? "https://api.openai.com/v1",
      apiKey: env("IMAGE_API_KEY") ?? env("MODEL_API_KEY") ?? null,
      model: env("IMAGE_MODEL") ?? "gpt-image-1",
      timeoutMs: intEnv("IMAGE_TIMEOUT_MS", 60_000),
    },
    research: {
      provider: researchProvider,
      apiKey: env("TAVILY_API_KEY") ?? null,
      timeoutMs: intEnv("WEB_RESEARCH_TIMEOUT_MS", 20_000),
    },
    adapterMode,
    workflowInline: boolEnv("WORKFLOW_INLINE", nodeEnv === "test"),
    demoFailExecution: boolEnv("DEMO_FAIL_EXECUTION", false),
    rateLimitMax: intEnv("RATE_LIMIT_MAX", 120),
    ...overrides,
  };

  if (config.isProduction && !env("SESSION_SECRET")) {
    throw new Error("SESSION_SECRET must be set in production. Generate at least 32 random characters.");
  }
  if (config.model.provider === "openai-compatible" && !config.model.apiKey) {
    throw new Error("MODEL_API_KEY is required when MODEL_PROVIDER=openai-compatible.");
  }
  if (config.image.provider === "openai-compatible" && !config.image.apiKey) {
    throw new Error("IMAGE_API_KEY or MODEL_API_KEY is required when IMAGE_PROVIDER=openai-compatible.");
  }
  if (config.research.provider === "tavily" && !config.research.apiKey) {
    throw new Error("TAVILY_API_KEY is required when WEB_RESEARCH_PROVIDER=tavily.");
  }

  return config;
}

/** Public, non-secret configuration that is safe to send to the browser. */
export function publicConfig(config: AppConfig) {
  return {
    demoMode: config.adapterMode === "demo",
    adapterMode: config.adapterMode,
    modelProvider: config.model.provider,
    modelName: config.model.model,
    modelConfigured: config.model.provider === "mock" || Boolean(config.model.apiKey),
    imageProvider: config.image.provider,
    researchProvider: config.research.provider,
    taskModels: config.model.taskModels,
    workflowMode: config.workflowInline ? "inline" : "background",
    persistence: config.databaseUrl ? "postgres" : "pglite",
    dataDir: config.isProduction ? undefined : config.dataDir,
  };
}
