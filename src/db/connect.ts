import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8_000 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
