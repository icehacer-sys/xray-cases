import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
/** Separate operating meter. Never records prompts, images, credentials or response text. */
export function recordUsage(stage: "image" | "slide" | "image-qa" | "copy-qa" | "caption" | "qa-preflight", model: string, usage: unknown): void {
  if (process.env.BOT_USAGE_LOG === "off") return;
  const file = resolve(process.env.BOT_USAGE_LOG ?? "data/usage.jsonl");
  const input = usage && typeof usage === "object" ? usage as Record<string, unknown> : {};
  const safe: Record<string, unknown> = {};
  for (const key of ["input_tokens", "output_tokens", "total_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "input_tokens_details", "output_tokens_details", "cache_creation", "server_tool_use"]) if (key in input) safe[key] = input[key];
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), stage, model, usage: safe, usageAvailable: !!usage }) + "\n");
}
