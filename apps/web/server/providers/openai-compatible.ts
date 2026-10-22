import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodType } from "zod";
import type { AppConfig, TaskProfile } from "../config.js";
import type {
  ModelCapabilities,
  ModelProvider,
  ProviderRegistry,
  StructuredGenerationRequest,
  TextGenerationRequest,
  TextGenerationResult,
} from "./types.js";
import { ModelProviderError } from "./types.js";
import { MockModelProvider } from "./mock/index.js";

interface ChatResult {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  modelId: string;
}

class OpenAICompatibleProvider implements ModelProvider {
  readonly id = "openai-compatible";
  readonly modelId: string;
  readonly capabilities: ModelCapabilities = {
    structuredOutput: true,
    toolCalls: false,
    streaming: false,
    imageInput: false,
  };

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;
  private readonly defaultTemperature: number;

  constructor(config: AppConfig, task: TaskProfile) {
    if (!config.model.apiKey) {
      throw new ModelProviderError("MODEL_API_KEY is not configured.", "not_configured", { retryable: false });
    }
    this.baseUrl = config.model.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.model.apiKey;
    this.timeoutMs = config.model.timeoutMs;
    this.maxOutputTokens = config.model.maxOutputTokens;
    this.defaultTemperature = config.model.temperature;
    this.modelId = config.model.taskModels[task] ?? config.model.model;
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const started = Date.now();
    const result = await this.chat(
      [
        { role: "system", content: request.system },
        { role: "user", content: request.prompt },
      ],
      { temperature: request.temperature, maxTokens: request.maxOutputTokens },
    );
    request.onUsage?.(
      { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      { providerId: this.id, modelId: result.modelId },
    );
    return {
      text: result.text,
      providerId: this.id,
      modelId: result.modelId,
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      latencyMs: Date.now() - started,
    };
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    const schema = zodToJsonSchema(request.schema as ZodType, {
      target: "jsonSchema7",
      $refStrategy: "none",
    });
    const schemaText = JSON.stringify(schema, null, 2);
    const system = `${request.system}

You must respond with a single JSON object only. No markdown fences, no commentary.
The object must validate against this JSON Schema:
${schemaText}`;

    const first = await this.chat(
      [
        { role: "system", content: system },
        { role: "user", content: request.prompt },
      ],
      {
        temperature: request.temperature ?? this.defaultTemperature,
        maxTokens: request.maxOutputTokens,
        jsonMode: true,
      },
    );

    try {
      const value = this.parseAndValidate(first.text, request.schema, request.schemaName);
      request.onUsage?.(
        { inputTokens: first.inputTokens, outputTokens: first.outputTokens },
        { providerId: this.id, modelId: first.modelId },
      );
      return value as T;
    } catch (error) {
      const corrective = await this.chat(
        [
          { role: "system", content: system },
          { role: "user", content: request.prompt },
          {
            role: "user",
            content: `Your previous response could not be validated (${(error as Error).message}). Return a corrected JSON object only.`,
          },
        ],
        { temperature: 0, maxTokens: request.maxOutputTokens, jsonMode: true },
      );
      const value = this.parseAndValidate(corrective.text, request.schema, request.schemaName);
      request.onUsage?.(
        { inputTokens: corrective.inputTokens, outputTokens: corrective.outputTokens },
        { providerId: this.id, modelId: corrective.modelId },
      );
      return value as T;
    }
  }

  private parseAndValidate<T>(text: string, schema: ZodType<T>, schemaName: string): T {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new ModelProviderError(`Model output for ${schemaName} was not a JSON object.`, "invalid_output");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch (error) {
      throw new ModelProviderError(`Model output for ${schemaName} was not valid JSON.`, "invalid_output", {
        cause: error,
      });
    }
    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      throw new ModelProviderError(
        `Model output for ${schemaName} failed schema validation${
          firstIssue ? `: ${firstIssue.path.join(".")} ${firstIssue.message}` : ""
        }.`,
        "invalid_output",
      );
    }
    return validation.data;
  }

  private async chat(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
  ): Promise<ChatResult> {
    const body: Record<string, unknown> = {
      model: this.modelId,
      messages,
      temperature: options.temperature ?? this.defaultTemperature,
      max_tokens: options.maxTokens ?? this.maxOutputTokens,
    };
    if (options.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const response = await this.fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const status = response.status;
      const text = (await response.text()).slice(0, 400);
      if (status === 401 || status === 403) {
        throw new ModelProviderError("The model provider rejected the configured credentials.", "auth", {
          retryable: false,
        });
      }
      if (status === 429) {
        throw new ModelProviderError("The model provider rate-limited this request.", "rate_limit");
      }
      if (status === 400 && options.jsonMode) {
        // Some compatible endpoints reject response_format. Retry once without it.
        const retryBody = { ...body };
        delete retryBody.response_format;
        const retry = await this.fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(retryBody),
        });
        if (retry.ok) return this.parseChatResponse(await retry.json());
      }
      throw new ModelProviderError(`The model provider returned HTTP ${status}.`, "provider_error", {
        cause: new Error(text),
      });
    }

    return this.parseChatResponse(await response.json());
  }

  private parseChatResponse(json: unknown): ChatResult {
    const payload = json as {
      model?: string;
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new ModelProviderError("The model provider returned an empty response.", "provider_error");
    }
    return {
      text,
      inputTokens: payload.usage?.prompt_tokens ?? null,
      outputTokens: payload.usage?.completion_tokens ?? null,
      modelId: payload.model ?? this.modelId,
    };
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new ModelProviderError("The model request timed out.", "timeout");
      }
      throw new ModelProviderError("The model provider could not be reached.", "provider_error", { cause: error });
    }
  }
}

export function createProviderRegistry(config: AppConfig): ProviderRegistry {
  const cache = new Map<string, ModelProvider>();

  return {
    forTask(task: TaskProfile): ModelProvider {
      const modelName = config.model.taskModels[task] ?? config.model.model;
      const key = `${config.model.provider}:${modelName}`;
      const cached = cache.get(key);
      if (cached) return cached;
      const provider =
        config.model.provider === "mock"
          ? new MockModelProvider(modelName)
          : new OpenAICompatibleProvider(config, task);
      cache.set(key, provider);
      return provider;
    },
    info() {
      return {
        providerId: config.model.provider,
        modelId: config.model.model,
        mode: config.model.provider === "mock" ? "mock" : "live",
        taskModels: config.model.taskModels,
      };
    },
  };
}
