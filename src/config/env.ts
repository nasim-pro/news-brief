import "dotenv/config";

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/news-brief",
  port: Number(process.env.PORT ?? 3000),
  aiProvider: process.env.AI_PROVIDER ?? "ollama",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "qwen2.5:7b",
  aiSelectionBatchSize: positiveInteger(process.env.AI_SELECTION_BATCH_SIZE, 15),
  aiMaxSelectionInputChars: positiveInteger(process.env.AI_MAX_SELECTION_INPUT_CHARS, 10_000),
  aiMaxDescriptionChars: positiveInteger(process.env.AI_MAX_DESCRIPTION_CHARS, 800),
  aiMaxContentChars: positiveInteger(process.env.AI_MAX_CONTENT_CHARS, 6_000),
  reutersFeedUrl: process.env.REUTERS_FEED_URL
};
