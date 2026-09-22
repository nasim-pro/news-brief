import type { Request, Response, NextFunction } from "express";
import { getLatestImportantStories } from "../services/newsService.js";
export async function latestNews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requested = Number(req.query.limit ?? 20); const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 50) : 20;
    const data = await getLatestImportantStories(limit); res.json({ data, meta: { count: data.length } });
  } catch (error) { next(error); }
}
