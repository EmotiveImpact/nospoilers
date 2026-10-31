/**
 * Swappable model providers for AI release review.
 *
 * Two tiers:
 * - reasoning: a frontier model under a zero-data-retention agreement. Writes the
 *   attacker-view review and double-checks every finding.
 * - triage (optional): a cheaper open model hosted in the US or EU for a first
 *   pass over large finding lists.
 *
 * Policy, enforced here rather than left to configuration discipline:
 * - nothing is enabled unless NOSPOILERS_AI_REVIEW=on;
 * - every provider must declare region us|eu and attest zero data retention;
 * - China-hosted API endpoints are refused;
 * - uncensored, abliterated or jailbreak-tuned model names are refused;
 * - endpoints must be HTTPS (plain HTTP only for loopback self-hosting).
 */
import Anthropic from "@anthropic-ai/sdk";

export type ModelTier = "reasoning" | "triage";
export type ModelRegion = "us" | "eu";

export type ModelRequest = {
  system: string;
  user: string;
  /** JSON Schema the reply must satisfy. Providers ask for JSON; callers still validate. */
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  signal: AbortSignal;
};

export type ModelReply = { text: string; inputTokens: number | null; outputTokens: number | null };

export type ModelProvider = {
  /** Non-sensitive label stored with each review, e.g. "anthropic". */
  id: string;
  model: string;
  tier: ModelTier;
  region: ModelRegion;
  host: string;
  zeroDataRetention: true;
  complete: (request: ModelRequest) => Promise<ModelReply>;
};

export type ProviderSettings = {
  kind: "anthropic" | "openai-compatible";
  tier: ModelTier;
  model: string;
  apiKey: string;
  baseUrl: string;
  region: string;
  zeroDataRetention: boolean;
  /** Claude effort level; ignored by other providers. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
};

export class ProviderPolicyError extends Error {}

/** API hosts operated from mainland China or by China-headquartered model labs. */
const BLOCKED_HOST_SUFFIXES = [
  ".cn",
  "deepseek.com",
  "bigmodel.cn",
  "zhipuai.cn",
  "z.ai",
  "moonshot.ai",
  "moonshot.cn",
  "aliyuncs.com",
  "alibabacloud.com",
  "dashscope.aliyuncs.com",
  "volces.com",
  "volcengine.com",
  "volcengineapi.com",
  "baichuan-ai.com",
  "minimax.chat",
  "minimaxi.com",
  "minimax.io",
  "siliconflow.com",
  "stepfun.com",
  "lingyiwanwu.com",
  "01.ai",
  "baidubce.com",
  "tencentcloudapi.com",
  "hunyuan.tencent.com",
  "sensenova.com",
  "xfyun.com",
];

const BLOCKED_MODEL =
  /uncensor|abliterat|jailbr|unfilter|unaligned|unrestrict|nsfw|no[-_]?guard|dolphin|lexi-|evil|hermes-?uncensored/i;

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function blockedHost(host: string): boolean {
  const lower = host.toLowerCase().replace(/\.$/, "");
  return BLOCKED_HOST_SUFFIXES.some((suffix) =>
    suffix.startsWith(".") ? lower.endsWith(suffix) : lower === suffix || lower.endsWith(`.${suffix}`),
  );
}

export function assertProviderAllowed(settings: ProviderSettings): URL {
  let url: URL;
  try {
    url = new URL(settings.baseUrl);
  } catch {
    throw new ProviderPolicyError(`The ${settings.tier} provider URL is not a valid URL.`);
  }
  if (url.username || url.password) throw new ProviderPolicyError("Provider URLs must not carry credentials.");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOOPBACK.has(url.hostname))) {
    throw new ProviderPolicyError(`The ${settings.tier} provider must use HTTPS.`);
  }
  if (blockedHost(url.hostname)) {
    throw new ProviderPolicyError(`${url.hostname} is a China-hosted model API. NoSpoilers does not send customer evidence there.`);
  }
  if (settings.region !== "us" && settings.region !== "eu") {
    throw new ProviderPolicyError(`Declare where the ${settings.tier} model is hosted: us or eu.`);
  }
  if (!settings.zeroDataRetention) {
    throw new ProviderPolicyError(`Attest zero data retention for the ${settings.tier} provider before enabling it.`);
  }
  if (!/^[A-Za-z0-9._:/@-]{1,120}$/.test(settings.model)) {
    throw new ProviderPolicyError(`The ${settings.tier} model name is not valid.`);
  }
  if (BLOCKED_MODEL.test(settings.model)) {
    throw new ProviderPolicyError(`${settings.model} looks like an uncensored or safety-stripped model. Use a standard release.`);
  }
  if (!settings.apiKey.trim()) throw new ProviderPolicyError(`The ${settings.tier} provider API key is missing.`);
  return url;
}

function anthropicProvider(settings: ProviderSettings, url: URL): ModelProvider {
  const client = new Anthropic({ apiKey: settings.apiKey, baseURL: url.origin, maxRetries: 2, timeout: 180_000 });
  return {
    id: "anthropic",
    model: settings.model,
    tier: settings.tier,
    region: settings.region as ModelRegion,
    host: url.hostname,
    zeroDataRetention: true,
    async complete(request) {
      // Streaming keeps long reviews clear of HTTP timeouts.
      const stream = client.beta.messages.stream(
        {
          model: settings.model,
          max_tokens: request.maxOutputTokens,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          output_config: {
            effort: settings.effort ?? "high",
            format: { type: "json_schema", schema: request.schema },
          },
          // If a safety classifier declines, the API retries on a suitable model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        },
        { signal: request.signal },
      );
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") throw new Error("The reasoning model declined this review.");
      if (message.stop_reason === "max_tokens") throw new Error("The reasoning model ran out of output space.");
      const text = message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      return { text, inputTokens: message.usage.input_tokens ?? null, outputTokens: message.usage.output_tokens ?? null };
    },
  };
}

/** Any OpenAI-style /chat/completions endpoint: Mistral (EU), US-hosted open-model platforms or self-hosted vLLM. */
function openAiCompatibleProvider(settings: ProviderSettings, url: URL, fetchImpl: typeof fetch): ModelProvider {
  const endpoint = `${url.origin}${url.pathname.replace(/\/+$/, "")}/chat/completions`;
  return {
    id: `openai-compatible:${url.hostname}`,
    model: settings.model,
    tier: settings.tier,
    region: settings.region as ModelRegion,
    host: url.hostname,
    zeroDataRetention: true,
    async complete(request) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        redirect: "error",
        signal: request.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: request.maxOutputTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `${request.system}\nReply with one JSON object matching this JSON Schema:\n${JSON.stringify(request.schema)}` },
            { role: "user", content: request.user },
          ],
        }),
      });
      if (!response.ok) throw new Error(`Triage model returned HTTP ${response.status}.`);
      const body = (await response.json()) as {
        choices?: { message?: { content?: unknown }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = body.choices?.[0];
      if (choice?.finish_reason === "length") throw new Error("The triage model ran out of output space.");
      const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
      return { text, inputTokens: body.usage?.prompt_tokens ?? null, outputTokens: body.usage?.completion_tokens ?? null };
    },
  };
}

export function createProvider(settings: ProviderSettings, fetchImpl: typeof fetch = fetch): ModelProvider {
  const url = assertProviderAllowed(settings);
  return settings.kind === "anthropic"
    ? anthropicProvider(settings, url)
    : openAiCompatibleProvider(settings, url, fetchImpl);
}

export type AiReviewConfig = {
  reasoning: ProviderSettings;
  triage: ProviderSettings | null;
  /** Reviews per installation or workspace per UTC day. */
  dailyReviews: number;
};

type Env = Record<string, string | undefined>;

function tierSettings(env: Env, tier: ModelTier): ProviderSettings | null {
  const prefix = tier === "reasoning" ? "NOSPOILERS_AI_REASONING" : "NOSPOILERS_AI_TRIAGE";
  const kind = (env[`${prefix}_PROVIDER`] ?? (tier === "reasoning" ? "anthropic" : "")).trim();
  if (!kind) return null;
  if (kind !== "anthropic" && kind !== "openai-compatible") {
    throw new ProviderPolicyError(`${prefix}_PROVIDER must be anthropic or openai-compatible.`);
  }
  const effort = env[`${prefix}_EFFORT`]?.trim();
  if (effort && !["low", "medium", "high", "xhigh", "max"].includes(effort)) {
    throw new ProviderPolicyError(`${prefix}_EFFORT must be low, medium, high, xhigh or max.`);
  }
  return {
    kind,
    tier,
    model: (env[`${prefix}_MODEL`] ?? (kind === "anthropic" ? "claude-opus-5-5" : "")).trim(),
    apiKey: (env[`${prefix}_API_KEY`] ?? (kind === "anthropic" ? env.ANTHROPIC_API_KEY ?? "" : "")).trim(),
    baseUrl: (env[`${prefix}_BASE_URL`] ?? (kind === "anthropic" ? "https://api.anthropic.com" : "")).trim(),
    region: (env[`${prefix}_REGION`] ?? "").trim().toLowerCase(),
    zeroDataRetention: env[`${prefix}_ZERO_DATA_RETENTION`]?.trim() === "attested",
    effort: (effort || undefined) as ProviderSettings["effort"],
  };
}

/**
 * Reads AI review settings. Returns null unless explicitly switched on, so a stray
 * ANTHROPIC_API_KEY never starts sending evidence anywhere.
 */
export function aiReviewConfigFromEnv(env: Env = process.env): AiReviewConfig | null {
  if (env.NOSPOILERS_AI_REVIEW?.trim() !== "on") return null;
  const reasoning = tierSettings(env, "reasoning");
  if (!reasoning) throw new ProviderPolicyError("Configure a reasoning provider for AI release review.");
  assertProviderAllowed(reasoning);
  const triage = tierSettings(env, "triage");
  if (triage) assertProviderAllowed(triage);
  const daily = Number(env.NOSPOILERS_AI_DAILY_REVIEWS ?? "40");
  if (!Number.isSafeInteger(daily) || daily < 1 || daily > 1000) {
    throw new ProviderPolicyError("NOSPOILERS_AI_DAILY_REVIEWS must be a whole number from 1 to 1000.");
  }
  return { reasoning, triage, dailyReviews: daily };
}
