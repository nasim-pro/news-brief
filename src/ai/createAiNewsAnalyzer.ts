import { env } from "../config/env.js";
import { OllamaNewsAnalyzer } from "./OllamaNewsAnalyzer.js";
import type { AiNewsAnalyzer } from "./AiNewsAnalyzer.js";

export function createAiNewsAnalyzer(): AiNewsAnalyzer {
  if (env.aiProvider === "ollama") return new OllamaNewsAnalyzer();
  throw new Error(`Unsupported AI provider: ${env.aiProvider}. Supported providers: ollama`);
}
