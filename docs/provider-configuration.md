# Provider configuration

Tulivu is model-agnostic. The default configuration is fully deterministic and free; nothing in the demo requires a paid model key. This document explains how to switch on live providers safely and what changes when you do.

## The two provider families

| Capability | `mock` | `openai-compatible` |
| --- | --- | --- |
| Text and structured output | Deterministic templates and canned validated objects | `POST {MODEL_BASE_URL}/chat/completions` |
| API key | Not required | Required |
| Network calls | None | Yes |
| Output variability | None; identical inputs produce comparable outputs | Model-dependent |
| Cost | Zero | Provider pricing applies |
| Intended use | Demo, tests, offline development | Pilots, evaluations, real drafting |

The mock provider is **not** a small language model. It is a deterministic generator that follows the same schemas and validation as a live model. It exists so the product loop, UI, versioning and approval flow can be demonstrated honestly without a key.

## Task profiles

Every stage asks the registry for a task profile rather than a hard-coded model:

| Profile | Used by | Typical choice |
| --- | --- | --- |
| `planning` | Strategy | Strong reasoning model |
| `copywriting` | Copy generation | Fast, creative, cheap model |
| `structured_extraction` | Intake, audience, assembly | Cheapest model that reliably follows JSON |
| `creative_direction` | Creative briefs | Mid-tier or strong model |
| `quality_review` | Optional independent critique | Strong, different model from copywriting |
| `fast_utility` | Small formatting/utility calls | Cheapest model |

Set a default and override per profile:

```dotenv
MODEL_PROVIDER=openai-compatible
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=sk-...
MODEL_NAME=gpt-4.1-mini

MODEL_PLANNING=gpt-4.1
MODEL_COPYWRITING=gpt-4.1-mini
MODEL_STRUCTURED_EXTRACTION=gpt-4.1-mini
MODEL_CREATIVE_DIRECTION=gpt-4.1
MODEL_QUALITY_REVIEW=gpt-4.1
MODEL_FAST_UTILITY=gpt-4.1-mini
```

Unset profiles fall back to `MODEL_NAME`. The provider registry caches one client per `provider:model` pair.

Best practice: use a **different model family or at least a different model** for `quality_review` than for copywriting. A model reviewing its own output is a weak check. The deterministic checks run regardless.

## OpenAI-compatible text adapter

Request shape:

```
POST {MODEL_BASE_URL}/chat/completions
Authorization: Bearer {MODEL_API_KEY}
Content-Type: application/json
```

The adapter:

- Sends a system message containing the task instructions and JSON Schema.
- Uses `response_format: { type: "json_object" }` for structured calls.
- Retries once without `response_format` if the endpoint returns HTTP 400.
- Parses the first JSON object from the response, tolerating markdown fences.
- Validates with Zod.
- On validation failure, makes one corrective call asking for fixed JSON.
- Retries are **not** applied to authentication or rate-limit failures; those surface as stage failures with a clear message.
- Measures input/output tokens when the provider returns `usage`.
- Times out after `MODEL_TIMEOUT_MS` (45 s default).

Compatible targets include OpenAI, Azure OpenAI-compatible gateways, OpenRouter, Together, Groq, vLLM, Ollama's OpenAI endpoint and similar services. The adapter does not use tool calling or streaming, so an endpoint that only supports basic chat completions is enough.

Tuning:

```dotenv
MODEL_TIMEOUT_MS=45000
MODEL_MAX_OUTPUT_TOKENS=2200
MODEL_TEMPERATURE=0.4
```

Lower temperature produces more repeatable copy. A very low `MODEL_MAX_OUTPUT_TOKENS` will truncate structured output and cause validation failures.

### Failure behaviour

| Condition | Result |
| --- | --- |
| Missing key with `MODEL_PROVIDER=openai-compatible` | Startup fails with a configuration error |
| 401/403 | Stage fails: credentials rejected |
| 429 | Stage fails after the engine's one retry: provider rate-limited |
| Timeout | Stage fails: model request timed out |
| Empty output | Stage fails: empty response |
| Invalid JSON/schema | One corrective retry, then stage fails |

Completed stages keep their artifacts. The run is marked failed and can be resumed from the failed stage.

## Mock provider

`MockModelProvider` produces schema-valid content tailored to the requested task, campaign and business context. It does not call a network. It is intentionally labelled `mock` in the run record and settings page.

Use it when:

- demonstrating the product without keys;
- running the test suite;
- developing UI changes offline;
- validating that workflow plumbing works before spending on tokens.

The quality stage notes explicitly that no independent model critique is available in mock mode.

## Image generation

`IMAGE_PROVIDER=mock` (default) produces deterministic SVG artwork using the brand palette, with a visible `MOCK VISUAL` label and a note to replace it. It uses no key and is fast.

`IMAGE_PROVIDER=openai-compatible` calls:

```
POST {IMAGE_BASE_URL}/images/generations
```

with `model`, `prompt`, `n: 1`, `response_format: "b64_json"` and a size derived from the requested aspect ratio:

| Requested shape | Sent size |
| --- | --- |
| Landscape | `1536x1024` |
| Portrait | `1024x1536` |
| Square | `1024x1024` |

The prompt asks the model **not** to render essential advertising text; the app layers text separately. It also passes the brand's banned-claim guidance as negative direction. Generated PNG bytes are stored through `AssetStorage`. With the local implementation they live under `ASSETS_DIR`; production needs a mounted disk or object storage for durability.

Configuration:

```dotenv
IMAGE_PROVIDER=openai-compatible
IMAGE_BASE_URL=https://api.openai.com/v1
IMAGE_API_KEY=sk-...          # falls back to MODEL_API_KEY
IMAGE_MODEL=gpt-image-1
IMAGE_TIMEOUT_MS=60000
```

Image calls can be slow and expensive. A four-asset campaign may make several calls. Set `IMAGE_PROVIDER=mock` while iterating on layout, then generate finals.

## Research

`WEB_RESEARCH_PROVIDER=mock` (default) returns an empty result set with a note. The audience stage then labels its output as hypotheses rather than market facts. This is deliberate.

`WEB_RESEARCH_PROVIDER=tavily` calls `https://api.tavily.com/search` with basic search depth. Results are summarised into the audience artifact with the provider recorded. Configure:

```dotenv
WEB_RESEARCH_PROVIDER=tavily
TAVILY_API_KEY=tvly-...
WEB_RESEARCH_TIMEOUT_MS=20000
```

Even with live research:

- It is not customer data or platform performance data.
- The artifact records `mode` and `provider` so the UI can distinguish hypothesis from evidence.
- Sources are consumer web search results, not validated market research.
- Check the research provider's terms, privacy policy and rate limits.

## Ad platform adapters

| Mode | Behaviour |
| --- | --- |
| `demo` (default) | Deterministic `PAUSED` resources for Meta and Google. No network. Clearly labelled simulated. Idempotent per channel/version. |
| `live` | Meta and Google adapters are explicit stubs. Every publish call throws `PlatformNotConfiguredError` with a message that demo mode can still simulate. |

There are **no live credentials, no OAuth flow, no real campaign creation and no performance metrics**. `ADAPTER_MODE=live` is intentionally not a supported path yet. Treat it as a guard rail, not a feature flag.

Adding a real adapter requires:

1. Official API/OAuth integration with least-privilege tokens.
2. Sandbox validation against the current platform API version.
3. Spend limits and explicit budget confirmation.
4. A new adapter implementation of the `AdPlatformAdapter` interface.
5. UI copy and exports that distinguish live from simulated resources.
6. Legal and platform-policy review.

## Environment reference

| Variable | Default | Notes |
| --- | --- | --- |
| `MODEL_PROVIDER` | `mock` | `mock` or `openai-compatible` |
| `MODEL_BASE_URL` | `https://api.openai.com/v1` | No trailing slash required |
| `MODEL_API_KEY` | unset | Required for live model calls |
| `MODEL_NAME` | `mock-tulivu-1` | Default model ID |
| `MODEL_<PROFILE>` | falls back | Six task profiles listed above |
| `MODEL_TIMEOUT_MS` | `45000` | Applied per request |
| `MODEL_MAX_OUTPUT_TOKENS` | `2200` | Too low truncates JSON |
| `MODEL_TEMPERATURE` | `0.4` | Structured calls may override |
| `IMAGE_PROVIDER` | `mock` | `mock` or `openai-compatible` |
| `IMAGE_BASE_URL` | `https://api.openai.com/v1` | |
| `IMAGE_API_KEY` | falls back to `MODEL_API_KEY` | |
| `IMAGE_MODEL` | `gpt-image-1` | |
| `IMAGE_TIMEOUT_MS` | `60000` | |
| `WEB_RESEARCH_PROVIDER` | `mock` | `mock` or `tavily` |
| `TAVILY_API_KEY` | unset | Required for Tavily |
| `WEB_RESEARCH_TIMEOUT_MS` | `20000` | |
| `ADAPTER_MODE` | `demo` | Live is unimplemented |

Startup validation rejects live providers without their required keys. This is intentional: a deployment should fail loudly rather than silently fall back to mock if it was configured for live generation.

## Cost and latency expectations

- Mock mode: milliseconds per stage, zero cost, deterministic.
- Live text models: one or more calls per stage; the quality stage adds an optional critique. Token usage is recorded per run.
- Live images: usually the slowest and most expensive part. Four placements can dominate both latency and cost.
- Research: one external search per audience stage when enabled.

There is no automatic spend cap on model calls. For a public deployment, use provider-side budgets, rate limits and a separate key with restricted scope. Do not put an unlimited production key in a public demo.
