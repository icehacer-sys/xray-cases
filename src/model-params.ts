import type Anthropic from "@anthropic-ai/sdk";

// Claude Sonnet 5.5 (and the other 5.x models) think by default, thinking counts toward max_tokens,
// and effort sets how much they think. Without headroom the 200-token genital check and the 1-token
// preflight would be cut off mid-thought. Older models get the exact request they always had.
const THINKS_BY_DEFAULT = /^claude-(?:sonnet-5-5|opus-5|fable-5|mythos-5|haiku-5-5)/;
const THINKING_HEADROOM = 6000;

export type Effort = "low" | "medium" | "high";

/** Adds an explicit effort level and thinking headroom for models that think by default. */
export function forModel(request: Anthropic.MessageCreateParamsNonStreaming, effort: Effort): Anthropic.MessageCreateParamsNonStreaming {
  if (!THINKS_BY_DEFAULT.test(request.model)) return request;
  const outputConfig = { ...((request as { output_config?: object }).output_config ?? {}), effort };
  return { ...request, max_tokens: request.max_tokens + THINKING_HEADROOM, output_config: outputConfig } as Anthropic.MessageCreateParamsNonStreaming;
}
