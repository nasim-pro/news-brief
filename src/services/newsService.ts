import { NewsStory } from "../models/NewsStory.js";
export async function getLatestImportantStories(limit: number) {
  const stories = await NewsStory.find({ important: true }).sort({ publishedAt: -1 }).limit(limit).lean();
  return stories.map((story) => ({ id: story._id.toString(), headline: story.headline, summary: story.summary, whyItMatters: story.whyItMatters, category: story.category, publishedAt: story.publishedAt.toISOString(), sources: story.sourceArticles.map((source) => ({ name: source.source, url: source.url })) }));
}
