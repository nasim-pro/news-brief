import express from "express";
import mongoose from "mongoose";
import { newsRouter } from "./routes/newsRoutes.js";
export const app = express();
app.use(express.json());
app.get("/api/health", (_req, res) => res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));
app.use("/api/news", newsRouter);
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(error); res.status(500).json({ error: "Internal server error" }); });
