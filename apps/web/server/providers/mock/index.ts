import type {
  ModelCapabilities,
  ModelProvider,
  StructuredGenerationRequest,
  TextGenerationRequest,
  TextGenerationResult,
} from "../types.js";
import { ModelProviderError } from "../types.js";
import { buildAudience, buildCopy, buildStrategy, critiqueQuality, normalizeBrief } from "./generators.js";
import { SCHEMA_NAMES } from "../contracts.js";

/**
 * Deterministic development provider. It never claims to have researched the
 * market or called an advertising platform. Outputs are grounded in the
 * supplied business profile and campaign brief.
 */
export class MockModelProvider implements ModelProvider {
  readonly id = "mock";
  readonly modelId: string;
  readonly capabilities: ModelCapabilities = {
    structuredOutput: true,
    toolCalls: false,
    streaming: false,
    imageInput: false,
  };

  constructor(modelId = "mock-tulivu-1") {
    this.modelId = modelId;
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const started = Date.now();
    const brief = request.context?.brief as { name?: string } | undefined;
    return {
      text: `Mock response for ${request.task}${brief?.name ? `: ${brief.name}` : ""}. Configure a live model provider for generative output.`,
      providerId: this.id,
      modelId: this.modelId,
      usage: { inputTokens: null, outputTokens: null },
      latencyMs: Date.now() - started,
    };
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    request.onUsage?.({ inputTokens: null, outputTokens: null }, { providerId: this.id, modelId: this.modelId });
    const context = request.context ?? {};
    let value: unknown;
    switch (request.schemaName) {
      case SCHEMA_NAMES.brief:
        value = normalizeBrief(context);
        break;
      case SCHEMA_NAMES.strategy:
        value = buildStrategy(context);
        break;
      case SCHEMA_NAMES.audience:
        value = buildAudience(context);
        break;
      case SCHEMA_NAMES.copy:
        value = buildCopy(context);
        break;
      case SCHEMA_NAMES.quality:
        value = critiqueQuality(context);
        break;
      default:
        throw new ModelProviderError(
          `The mock provider has no deterministic handler for "${request.schemaName}". Configure a live model provider.`,
          "not_configured",
          { retryable: false },
        );
    }
    return request.schema.parse(value) as T;
  }
}
