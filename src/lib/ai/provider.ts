import Anthropic from "@anthropic-ai/sdk";

/**
 * The single seam between Planadate and any LLM vendor.
 *
 * Everything above this file speaks in terms of `generateJson` -- a prompt in,
 * schema-shaped JSON out. Swapping vendors (or adding a second one for
 * failover) means adding another implementation of `LlmProvider`, not touching
 * the planner. The bundled `mock` provider is a deterministic, offline planner
 * so the whole product works with no API key configured.
 */

export type JsonRequest = {
  system: string;
  prompt: string;
  /** JSON Schema the response must satisfy. */
  schema: unknown;
  schemaName: string;
  /** Rough ceiling; providers may clamp. */
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
};

export interface LlmProvider {
  readonly id: string;
  readonly available: boolean;
  generateJson(request: JsonRequest): Promise<unknown>;
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

export class LlmRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmRefusedError";
  }
}

// ------------------------------------------------------------- anthropic

const DEFAULT_MODEL = "claude-opus-5";

class AnthropicProvider implements LlmProvider {
  readonly id: string;
  private client: Anthropic | null;
  private model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    this.model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.id = `anthropic:${this.model}`;
  }

  get available(): boolean {
    return this.client !== null;
  }

  async generateJson(request: JsonRequest): Promise<unknown> {
    if (!this.client) {
      throw new LlmUnavailableError(
        "ANTHROPIC_API_KEY is not set. Set it, or set AI_PROVIDER=mock to use the offline planner.",
      );
    }

    // `thinking: "adaptive"` is a current-model feature not yet reflected in
    // this SDK version's stable types (it only types "enabled"/"disabled"),
    // so the request body is built as unknown and cast at the call boundary.
    const params = {
      model: this.model,
      max_tokens: request.maxTokens ?? 16000,
      system: request.system,
      thinking: { type: "adaptive" },
      output_config: {
        effort: request.effort ?? "medium",
        format: {
          type: "json_schema",
          schema: request.schema as Record<string, unknown>,
        },
      },
      messages: [{ role: "user", content: request.prompt }],
    };
    const response = await this.client.messages.create(
      params as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );

    if (response.stop_reason === "refusal") {
      throw new LlmRefusedError(
        "The planning model declined this request. Try rewording your notes.",
      );
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) throw new Error("The planning model returned an empty response.");

    try {
      return JSON.parse(text);
    } catch {
      // Guard against a stray code fence if a future model wraps the payload.
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenced?.[1]) return JSON.parse(fenced[1]);
      throw new Error("The planning model returned malformed JSON.");
    }
  }
}

// ------------------------------------------------------------------ mock

/**
 * Offline provider. It does no language understanding -- `planner.ts` falls
 * back to its deterministic assembler when this provider is selected, so the
 * app is fully usable (and demoable) without network access or a key.
 */
class MockProvider implements LlmProvider {
  readonly id = "mock:deterministic";
  readonly available = true;

  async generateJson(): Promise<unknown> {
    throw new LlmUnavailableError("mock-provider");
  }
}

let cached: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (cached) return cached;
  const configured = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
  cached = configured === "mock" ? new MockProvider() : new AnthropicProvider();
  return cached;
}

/** Test seam. */
export function __setLlmProvider(provider: LlmProvider | null): void {
  cached = provider;
}
