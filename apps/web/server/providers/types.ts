import type { ZodType } from "zod";
import type { TaskProfile } from "../config.js";

export interface TextGenerationRequest {
  system: string;
  prompt: string;
  task: TaskProfile;
  /** Application-owned structured context. It is not provider-specific. */
  context?: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
  /** Optional usage callback so workflow metadata does not depend on provider return types. */
  onUsage?: (usage: GenerationUsage, meta: { providerId: string; modelId: string }) => void;
}

export interface GenerationUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface TextGenerationResult {
  text: string;
  providerId: string;
  modelId: string;
  usage: GenerationUsage;
  latencyMs: number;
}

export interface StructuredGenerationRequest<T> extends TextGenerationRequest {
  schemaName: string;
  schema: ZodType<T>;
}

export interface ModelCapabilities {
  structuredOutput: boolean;
  toolCalls: boolean;
  streaming: boolean;
  imageInput: boolean;
}

export interface ModelProvider {
  id: string;
  modelId: string;
  capabilities: ModelCapabilities;
  generateText(request: TextGenerationRequest): Promise<TextGenerationResult>;
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T>;
  streamText?(request: TextGenerationRequest): AsyncIterable<string>;
}

export class ModelProviderError extends Error {
  readonly code: "timeout" | "auth" | "rate_limit" | "invalid_output" | "provider_error" | "not_configured";
  readonly retryable: boolean;

  constructor(
    message: string,
    code: ModelProviderError["code"] = "provider_error",
    options?: { retryable?: boolean; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "ModelProviderError";
    this.code = code;
    this.retryable = options?.retryable ?? (code === "timeout" || code === "rate_limit" || code === "provider_error");
  }
}

export interface ModelInfo {
  providerId: string;
  modelId: string;
  mode: "mock" | "live";
  taskModels: Record<TaskProfile, string>;
}

export interface ProviderRegistry {
  forTask(task: TaskProfile): ModelProvider;
  info(): ModelInfo;
}
