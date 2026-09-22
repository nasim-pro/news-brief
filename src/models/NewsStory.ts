import { Schema, model } from "mongoose";
import { categories } from "./NewsArticle.js";

const sourceArticleSchema = new Schema({ articleId: { type: Schema.Types.ObjectId, required: true }, source: String, url: String, title: String }, { _id: false });
const storySchema = new Schema({
  headline: { type: String, required: true }, summary: { type: String, required: true }, whyItMatters: { type: String, required: true },
  category: { type: String, enum: categories, required: true }, publishedAt: { type: Date, required: true }, processedAt: { type: Date, required: true },
  important: { type: Boolean, required: true, default: true, index: true }, sourceArticles: { type: [sourceArticleSchema], required: true }
}, { timestamps: true });
storySchema.index({ important: 1, publishedAt: -1 });
storySchema.index({ processedAt: -1 });
storySchema.index({ category: 1 });
export const NewsStory = model("NewsStory", storySchema);
