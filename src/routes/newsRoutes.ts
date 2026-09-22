import { Router } from "express";
import { latestNews } from "../controllers/newsController.js";
export const newsRouter = Router();
newsRouter.get("/latest", latestNews);
