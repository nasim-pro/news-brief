import { Schema, model, type InferSchemaType } from "mongoose";

export const categories = ["india", "world", "science", "technology", "business", "geopolitics", "climate", "health", "space", "other"] as const;
const articleSchema = new Schema({
  source: { type: String, required: true, index: true },
  sourceId: { type: String, index: true },
  title: { type: String, required: true },
  url: { type: String, required: true, unique: true },
  description: String,
  publishedAt: { type: Date, required: true, index: true },
  category: { type: String, enum: categories, required: true },
  content: String,
  fetchedAt: { type: Date, required: true },
  processedAt: Date
}, { timestamps: true });
articleSchema.index({ source: 1, sourceId: 1 }, { sparse: true });
export type NewsArticleDocument = InferSchemaType<typeof articleSchema>;
export const NewsArticle = model("NewsArticle", articleSchema);
