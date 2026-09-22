import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./db/connect.js";
async function main() { await connectDatabase(); app.listen(env.port, () => console.log(`News Brief API listening on http://localhost:${env.port}`)); }
main().catch((error) => { console.error("Server failed to start:", error); process.exit(1); });
